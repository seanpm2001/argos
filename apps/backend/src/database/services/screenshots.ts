import type { PartialModelObject, TransactionOrKnex } from "objection";

import { transaction } from "@/database/index.js";
import {
  Build,
  File,
  Screenshot,
  ScreenshotMetadata,
  Test,
} from "@/database/models/index.js";

const getOrCreateTests = async ({
  projectId,
  buildName,
  screenshotNames,
  trx,
}: {
  projectId: string;
  buildName: string;
  screenshotNames: string[];
  trx: TransactionOrKnex;
}) => {
  const tests: Test[] = await Test.query(trx)
    .where({ projectId, buildName })
    .whereIn("name", screenshotNames);
  const testNames = tests.map(({ name }: Test) => name);
  const testNamesToAdd = screenshotNames.filter(
    (screenshotName) => !testNames.includes(screenshotName),
  );
  if (testNamesToAdd.length === 0) {
    return tests;
  }

  const addedTests = await Test.query(trx).insertAndFetch(
    testNamesToAdd.map((name) => ({
      name: name,
      projectId,
      buildName,
    })),
  );
  return [...tests, ...addedTests];
};

export const getUnknownScreenshotKeys = async (keys: string[]) => {
  const existingFiles = await File.query().select("key").whereIn("key", keys);
  const existingKeys = existingFiles.map((file) => file.key);
  return Array.from(new Set(keys.filter((key) => !existingKeys.includes(key))));
};

type InsertFilesAndScreenshotsParams = {
  screenshots: {
    key: string;
    name: string;
    metadata: ScreenshotMetadata | null;
  }[];
  build: Build;
  unknownKeys?: string[];
  trx?: TransactionOrKnex;
};

/**
 * @returns The number of screenshots inserted
 */
export const insertFilesAndScreenshots = async (
  params: InsertFilesAndScreenshotsParams,
): Promise<number> => {
  return await transaction(params.trx, async (trx) => {
    if (params.screenshots.length === 0) return 0;

    const unknownKeys =
      params.unknownKeys ||
      (await getUnknownScreenshotKeys(
        params.screenshots.map((screenshot) => screenshot.key),
      ));

    if (unknownKeys.length > 0) {
      // Insert unknown files
      await File.query(trx)
        .insert(unknownKeys.map((key) => ({ key })))
        .onConflict("key")
        .ignore();
    }

    const screenshotKeys = params.screenshots.map(
      (screenshot) => screenshot.key,
    );
    const [files, tests, duplicates] = await Promise.all([
      File.query(trx).whereIn("key", screenshotKeys),
      getOrCreateTests({
        projectId: params.build.projectId,
        buildName: params.build.name,
        screenshotNames: params.screenshots.map(
          (screenshot) => screenshot.name,
        ),
        trx,
      }),
      Screenshot.query(trx)
        .select("name")
        .where({
          name: params.screenshots.map((screenshot) => screenshot.name),
          screenshotBucketId: params.build.compareScreenshotBucketId,
        }),
    ]);

    if (duplicates.length > 0) {
      throw new Error(
        `Screenshots already uploaded for ${duplicates
          .map((screenshot) => screenshot.name)
          .join(
            ", ",
          )}. Please ensure to not upload a screenshot with the same name multiple times.`,
      );
    }

    // Insert screenshots
    await Screenshot.query(trx).insert(
      params.screenshots.map((screenshot): PartialModelObject<Screenshot> => {
        const file = files.find((f) => f.key === screenshot.key);
        if (!file) {
          throw new Error(`File not found for key ${screenshot.key}`);
        }
        const test = tests.find((t) => t.name === screenshot.name);
        if (!test) {
          throw new Error(`Test not found for screenshot ${screenshot.name}`);
        }
        return {
          screenshotBucketId: params.build.compareScreenshotBucketId,
          name: screenshot.name,
          s3Id: screenshot.key,
          fileId: file.id,
          testId: test.id,
          metadata: screenshot.metadata,
        };
      }),
    );

    return params.screenshots.length;
  });
};