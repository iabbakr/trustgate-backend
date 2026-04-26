import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  url: process.env.REDIS_URL
});

client.on("error", (err) => {
  console.log("Redis Error:", err);
});

await client.connect();

await client.set("test", "trustgate works");
const value = await client.get("test");

console.log(value);

await client.disconnect();