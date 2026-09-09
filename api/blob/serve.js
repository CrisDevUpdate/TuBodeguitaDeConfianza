import { servirVistaBlob } from '../_lib/blob.js';

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  return await servirVistaBlob(req, res);
}
