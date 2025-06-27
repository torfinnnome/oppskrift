-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "displayName" TEXT,
    "password" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiry" DATETIME,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "roles" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system'
);
INSERT INTO "new_User" ("createdAt", "displayName", "email", "id", "isApproved", "password", "resetToken", "resetTokenExpiry", "roles", "updatedAt") SELECT "createdAt", "displayName", "email", "id", "isApproved", "password", "resetToken", "resetTokenExpiry", "roles", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
