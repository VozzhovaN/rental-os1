-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "commissionRateBps" INTEGER;

-- CreateTable
CREATE TABLE "BookingPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" DATETIME NOT NULL,
    "method" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingPaymentRefund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "refundedAt" DATETIME NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingPaymentRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "BookingPayment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BookingPayment_bookingId_paidAt_idx" ON "BookingPayment"("bookingId", "paidAt");

-- CreateIndex
CREATE INDEX "BookingPaymentRefund_paymentId_refundedAt_idx" ON "BookingPaymentRefund"("paymentId", "refundedAt");
