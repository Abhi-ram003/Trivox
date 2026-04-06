import { getPublicConfig } from "../lib/chat.js";

export default function handler(_request, response) {
  response.status(200).json(getPublicConfig(process.env));
}
