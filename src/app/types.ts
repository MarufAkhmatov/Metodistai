export type FolderInfo = {
  name: string;
  documentCount: number;
  subfolderCount: number;
  modifiedAt: string | null;
};

export type DocumentInfo = {
  name: string;
  format: string;
  sizeBytes: number;
  modifiedAt: string;
};

export type SubfolderInfo = {
  name: string;
  documentCount: number;
};

export type FolderDocuments = {
  folder: string;
  modifiedAt: string | null;
  documents: DocumentInfo[];
  subfolders: SubfolderInfo[];
};
