import {
  type Buyer,
  type BuyerInterest,
  type Deposit,
  type DepositStatus,
  type Property,
  type SaleListing,
} from "@prisma/client";
import { canTransitionBuyerInterest } from "@/lib/buyer-interest-fsm";
import { recordBuyerHistory } from "@/lib/buyer-history";
import { prisma } from "@/lib/prisma";
import type { CreateDepositInput } from "@/lib/validations/viewing-deposit";

export class DepositError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT" | "VALIDATION",
    readonly machineCode?:
      | "SALE_LISTING_ALREADY_HAS_PAID_DEPOSIT"
      | "SALE_LISTING_ALREADY_SOLD",
  ) {
    super(message);
    this.name = "DepositError";
  }
}

const depositInclude = {
  buyerInterest: {
    include: {
      buyer: true,
      saleListing: { include: { property: true } },
    },
  },
} as const;

type DepositRecord = Deposit & {
  buyerInterest: BuyerInterest & {
    buyer: Buyer;
    saleListing: SaleListing & { property: Property };
  };
};

export type DepositDTO = {
  id: string;
  buyerInterestId: string;
  amount: number;
  paidAt: string | null;
  status: DepositStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  buyerName: string;
  propertyName: string;
  saleListingId: string;
};

export function serializeDeposit(deposit: DepositRecord): DepositDTO {
  return {
    id: deposit.id,
    buyerInterestId: deposit.buyerInterestId,
    amount: deposit.amount,
    paidAt: deposit.paidAt?.toISOString() ?? null,
    status: deposit.status,
    notes: deposit.notes,
    createdAt: deposit.createdAt.toISOString(),
    updatedAt: deposit.updatedAt.toISOString(),
    buyerName: deposit.buyerInterest.buyer.name,
    propertyName:
      deposit.buyerInterest.saleListing.marketingTitle ||
      deposit.buyerInterest.saleListing.property.name,
    saleListingId: deposit.buyerInterest.saleListingId,
  };
}

export async function getDepositsByInterest(buyerInterestId: string) {
  return prisma.deposit.findMany({
    where: { buyerInterestId },
    include: depositInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getDepositsBySaleListing(saleListingId: string) {
  return prisma.deposit.findMany({
    where: { buyerInterest: { saleListingId } },
    include: depositInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getDepositById(id: string) {
  return prisma.deposit.findUnique({
    where: { id },
    include: depositInclude,
  });
}

export async function createDeposit(buyerInterestId: string, input: CreateDepositInput) {
  const interest = await prisma.buyerInterest.findUnique({
    where: { id: buyerInterestId },
    include: { saleListing: true, buyer: true },
  });
  if (!interest) {
    throw new DepositError("Интерес не найден", "NOT_FOUND");
  }
  if (interest.saleListing.status === "SOLD") {
    throw new DepositError("Объект уже продан", "CONFLICT", "SALE_LISTING_ALREADY_SOLD");
  }
  if (interest.status === "PURCHASED" || interest.status === "REFUSED") {
    throw new DepositError(
      "Нельзя создать задаток для завершённого или отказанного интереса",
      "VALIDATION",
    );
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new DepositError("Сумма задатка должна быть больше 0", "VALIDATION");
  }

  return prisma.$transaction(async (tx) => {
    const deposit = await tx.deposit.create({
      data: {
        buyerInterestId,
        amount: input.amount,
        status: "PENDING",
        notes: input.notes ?? null,
      },
      include: depositInclude,
    });
    await recordBuyerHistory(
      {
        buyerId: interest.buyerId,
        buyerInterestId,
        type: "DEPOSIT_CREATED",
        message: `Создан задаток ${input.amount} ₽`,
      },
      tx,
    );
    return deposit;
  });
}

export async function payDeposit(id: string) {
  const current = await getDepositById(id);
  if (!current) {
    throw new DepositError("Задаток не найден", "NOT_FOUND");
  }
  if (current.status !== "PENDING") {
    throw new DepositError("Оплатить можно только задаток в статусе PENDING", "VALIDATION");
  }
  if (current.buyerInterest.saleListing.status === "SOLD") {
    throw new DepositError("Объект уже продан", "CONFLICT", "SALE_LISTING_ALREADY_SOLD");
  }

  const saleListingId = current.buyerInterest.saleListingId;

  try {
    return await prisma.$transaction(async (tx) => {
      const conflicting = await tx.deposit.findFirst({
        where: {
          status: "PAID",
          id: { not: id },
          buyerInterest: { saleListingId },
        },
      });
      if (conflicting) {
        throw new DepositError(
          "По этому объекту уже есть активный оплаченный задаток другого покупателя.",
          "CONFLICT",
          "SALE_LISTING_ALREADY_HAS_PAID_DEPOSIT",
        );
      }

      const deposit = await tx.deposit.update({
        where: { id },
        data: {
          status: "PAID",
          paidAt: new Date(),
        },
      });

      const interest = await tx.buyerInterest.findUniqueOrThrow({
        where: { id: current.buyerInterestId },
      });
      if (canTransitionBuyerInterest(interest.status, "DEPOSIT_PAID")) {
        await tx.buyerInterest.update({
          where: { id: interest.id },
          data: { status: "DEPOSIT_PAID" },
        });
      }

      await recordBuyerHistory(
        {
          buyerId: current.buyerInterest.buyerId,
          buyerInterestId: current.buyerInterestId,
          type: "DEPOSIT_PAID",
          message: `Задаток ${current.amount} ₽ отмечен как оплаченный`,
        },
        tx,
      );

      return tx.deposit.findUniqueOrThrow({
        where: { id: deposit.id },
        include: depositInclude,
      });
    });
  } catch (error) {
    if (error instanceof DepositError) {
      throw error;
    }
    throw error;
  }
}

async function settlePaidDeposit(
  id: string,
  nextStatus: Extract<DepositStatus, "REFUNDED" | "FORFEITED">,
) {
  const current = await getDepositById(id);
  if (!current) {
    throw new DepositError("Задаток не найден", "NOT_FOUND");
  }
  if (current.status !== "PAID") {
    throw new DepositError(
      `Переход в ${nextStatus} возможен только из PAID`,
      "VALIDATION",
    );
  }

  return prisma.$transaction(async (tx) => {
    const deposit = await tx.deposit.update({
      where: { id },
      data: { status: nextStatus },
      include: depositInclude,
    });
    await recordBuyerHistory(
      {
        buyerId: current.buyerInterest.buyerId,
        buyerInterestId: current.buyerInterestId,
        type: nextStatus === "REFUNDED" ? "DEPOSIT_REFUNDED" : "DEPOSIT_FORFEITED",
        message:
          nextStatus === "REFUNDED"
            ? `Задаток ${current.amount} ₽ возвращён`
            : `Задаток ${current.amount} ₽ удержан`,
      },
      tx,
    );
    return deposit;
  });
}

export async function refundDeposit(id: string) {
  return settlePaidDeposit(id, "REFUNDED");
}

export async function forfeitDeposit(id: string) {
  return settlePaidDeposit(id, "FORFEITED");
}
