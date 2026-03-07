import { drive_v3 } from 'googleapis';

function escapeDriveQueryString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function readFile(
  drive: drive_v3.Drive,
  fileId: string
): Promise<string> {
  const response = await drive.files.get({
    fileId,
    alt: 'media',
  });

  return response.data as string;
}

export async function writeFile(
  drive: drive_v3.Drive,
  fileId: string,
  content: string
): Promise<void> {
  await drive.files.update({
    fileId,
    media: {
      mimeType: 'text/plain',
      body: content,
    },
  });
}

export async function createTextFile(
  drive: drive_v3.Drive,
  name: string,
  content: string,
  parentFolderId: string
): Promise<string> {
  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'text/plain',
      parents: [parentFolderId],
    },
    media: {
      mimeType: 'text/plain',
      body: content,
    },
    fields: 'id',
  });

  return response.data.id as string;
}

export async function listFiles(
  drive: drive_v3.Drive,
  folderId: string,
  mimeType?: string
): Promise<Array<{ id: string; name: string }>> {
  let query = `'${escapeDriveQueryString(folderId)}' in parents and trashed = false`;
  if (mimeType) {
    query += ` and mimeType = '${escapeDriveQueryString(mimeType)}'`;
  }

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
  });

  return (response.data.files as Array<{ id: string; name: string }>) || [];
}

export async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string
): Promise<string> {
  const existingFolderId = await findFolder(drive, name, parentId);
  if (existingFolderId) {
    return existingFolderId;
  }

  const createParams: drive_v3.Params$Resource$Files$Create = {
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  };

  if (parentId) {
    createParams.requestBody!.parents = [parentId];
  }

  const created = await drive.files.create(createParams);
  return created.data.id as string;
}

export async function findFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string
): Promise<string | null> {
  let query = `name = '${escapeDriveQueryString(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    query += ` and '${escapeDriveQueryString(parentId)}' in parents`;
  }

  const response = await drive.files.list({
    q: query,
    fields: 'files(id)',
  });

  const files = response.data.files;
  if (files && files.length > 0 && files[0].id) {
    return files[0].id;
  }

  return null;
}

export async function findFile(
  drive: drive_v3.Drive,
  name: string,
  parentId: string
): Promise<string | null> {
  const query = `name = '${escapeDriveQueryString(name)}' and '${escapeDriveQueryString(parentId)}' in parents and trashed = false`;

  const response = await drive.files.list({
    q: query,
    fields: 'files(id)',
  });

  const files = response.data.files;
  if (files && files.length > 0 && files[0].id) {
    return files[0].id;
  }

  return null;
}

export async function findSpreadsheet(
  drive: drive_v3.Drive,
  name: string
): Promise<string | null> {
  const query = `name = '${escapeDriveQueryString(name)}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;

  const response = await drive.files.list({
    q: query,
    fields: 'files(id)',
  });

  const files = response.data.files;
  if (files && files.length > 0 && files[0].id) {
    return files[0].id;
  }

  return null;
}

export async function findSpreadsheetInFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string
): Promise<string | null> {
  const query = `name = '${escapeDriveQueryString(name)}' and mimeType = 'application/vnd.google-apps.spreadsheet' and '${escapeDriveQueryString(parentId)}' in parents and trashed = false`;

  const response = await drive.files.list({
    q: query,
    fields: 'files(id)',
  });

  const files = response.data.files;
  if (files && files.length > 0 && files[0].id) {
    return files[0].id;
  }

  return null;
}
