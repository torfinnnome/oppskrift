ALTER TABLE "User" ADD COLUMN "resetToken" TEXT;
ALTER TABLE "User" ADD COLUMN "resetTokenExpiry" DATETIME;
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");