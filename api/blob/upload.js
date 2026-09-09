import { procesarSubidaBlob } from '../_lib/blob.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  return await procesarSubidaBlob(req, res);
}
