import { db } from "../src/db.js";
import { config } from "../src/config.js";

const execute = process.argv.includes("--execute");
const confirmIndex = process.argv.indexOf("--confirm");
const confirmation = confirmIndex >= 0 ? process.argv[confirmIndex + 1] : undefined;
const requiredConfirmation = "DELETE_ALL_ARTWORK";

function databaseLabel() {
  try {
    const url = new URL(config.DATABASE_URL);
    return `${url.hostname}/${url.pathname.replace(/^\//, "")}`;
  } catch {
    return "configured database";
  }
}

async function countIfPresent(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2021") return 0;
    throw error;
  }
}

try {
  const counts = {
    submissions: await db.submission.count(),
    votes: await db.vote.count(),
    voteEvents: await db.voteEvent.count(),
    statusEvents: await db.submissionStatusEvent.count(),
    accessories: await countIfPresent(() => db.submissionAccessory.count()),
    galleryEntries: await db.galleryEntry.count(),
    feeShares: await db.feeShare.count(),
    creatorAccruals: await db.creatorAccrual.count(),
  };

  console.log(`Target: ${databaseLabel()}`);
  console.table(counts);

  if (!execute) {
    console.log("Dry run only. Nothing was deleted.");
    console.log(`To delete: npm run clear:artwork -- --execute --confirm ${requiredConfirmation}`);
  } else if (confirmation !== requiredConfirmation) {
    throw new Error(`Confirmation missing. Pass --confirm ${requiredConfirmation} exactly.`);
  } else if (counts.creatorAccruals > 0) {
    throw new Error(
      "Deletion stopped because creator accrual records exist. Preserve and reconcile financial records before removing artwork.",
    );
  } else {
    const deleted = await db.$transaction(async (tx) => {
      const feeShares = await tx.feeShare.deleteMany();
      const galleryEntries = await tx.galleryEntry.deleteMany();
      const submissions = await tx.submission.deleteMany();
      const idempotencyRecords = await tx.idempotencyRecord.deleteMany({
        where: {
          OR: [
            { scope: "publish-submission" },
            { scope: { startsWith: "vote:" } },
          ],
        },
      });
      return {
        submissions: submissions.count,
        galleryEntries: galleryEntries.count,
        feeShares: feeShares.count,
        idempotencyRecords: idempotencyRecords.count,
      };
    });

    console.log("Artwork submissions and votes were cleared.");
    console.table({
      ...deleted,
      votes: counts.votes,
      voteEvents: counts.voteEvents,
      statusEvents: counts.statusEvents,
      accessories: counts.accessories,
    });
    console.log("Drafts, users, applications, risk records, and object-storage files were kept.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
