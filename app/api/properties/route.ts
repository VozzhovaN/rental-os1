import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { PropertyError, createProperty, getProperties } from "@/lib/properties";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  createPropertySchema,
  formatZodError,
} from "@/lib/validations/property";

export const GET = withApiAuth(async (_request: Request) => {
  const properties = await getProperties();
  return NextResponse.json({ properties });
});

export const POST = withApiAuth(async (request: Request) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Некорректный JSON" },
      { status: 400 },
    );
  }

  const parsed = createPropertySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка валидации", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const property = await createProperty(parsed.data);
    return NextResponse.json({ property }, { status: 201 });
  } catch (error) {
    if (error instanceof PropertyError) {
      const status =
        error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Объект с таким slug уже существует" },
        { status: 409 },
      );
    }

    throw error;
  }
});
