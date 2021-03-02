import { getDb } from 'db';

export async function dumpAllDocs(includeDocs = false) {
  const db = await getDb();

  const result = await db.allDocs({
    include_docs: includeDocs,
  });

  console.log(result);

  return result;
}
