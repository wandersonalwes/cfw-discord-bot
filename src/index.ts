import {
  verifyKey,
  InteractionType,
  InteractionResponseType,
} from "discord-interactions";
import { Router } from "itty-router";
import { RANDOM_QUOTE_COMMAND } from "./commands";
import { getRandomQuote } from "./random-quote";
import { registerGlobalCommands } from "./register";

export interface Env {
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
}

class JsonResponse extends Response {
  constructor(body?: any, init?: ResponseInit) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        "content-type": "application/json;charset=UTF-8",
      },
    };
    super(jsonBody, init);
  }
}

const router = Router();

/**
 * A simple :wave: hello page to verify the worker is working.
 */
router.get("/", (request, env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
router.post("/", async (request) => {
  const message = await request.json();
  if (message.type === InteractionType.PING) {
    // The `PING` message is used during the initial webhook handshake, and is
    // required to configure the webhook in the developer portal.
    console.log("Handling Ping request");
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }

  if (message.type === InteractionType.APPLICATION_COMMAND) {
    // Most user commands will come as `APPLICATION_COMMAND`.
    switch (message.data.name.toLowerCase()) {
      case RANDOM_QUOTE_COMMAND.name.toLowerCase(): {
        const quote = getRandomQuote();
        return new JsonResponse({
          type: 4,
          data: {
            content: quote,
          },
        });
      }
      default:
        console.error("Unknown Command");
        return new JsonResponse({ error: "Unknown Type" }, { status: 400 });
    }
  }

  console.error("Unknown Type");
  return new JsonResponse({ error: "Unknown Type" }, { status: 400 });
});

router.put("/register", async (request, env: Env) => {
  try {
    await registerGlobalCommands(env.DISCORD_APPLICATION_ID, env.DISCORD_TOKEN);

    return new JsonResponse({ data: "Registered all commands" });
  } catch (error) {
    if (error instanceof Error) {
      return new JsonResponse({ error: error.message }, { status: 403 });
    } else {
      return new JsonResponse({ error: "Unexpect error" }, { status: 500 });
    }
  }
});

router.all("*", () => new Response("Not Found.", { status: 404 }));

export default {
  /**
   * Every request to a worker will start in the `fetch` method.
   * Verify the signature with the request, and dispatch to the router.
   * @param {*} request A Fetch Request object
   * @param {*} env A map of key/value pairs with env vars and secrets from the cloudflare env.
   * @returns
   */
  async fetch(request: Request, env: Env) {
    if (request.method === "POST") {
      // Using the incoming headers, verify this request actually came from discord.
      const signature = request.headers.get("x-signature-ed25519");
      const timestamp = request.headers.get("x-signature-timestamp");
      console.log(signature, timestamp, env.DISCORD_PUBLIC_KEY);
      const body = await request.clone().arrayBuffer();

      if (!signature || !timestamp) {
        return new Response(
          JSON.stringify({
            error: "required params not found",
          })
        );
      }

      const isValidRequest = verifyKey(
        body,
        signature,
        timestamp,
        env.DISCORD_PUBLIC_KEY
      );
      if (!isValidRequest) {
        console.error("Invalid Request");
        return new Response("Bad request signature.", { status: 401 });
      }
    }

    // Dispatch the request to the appropriate route
    return router.handle(request, env);
  },
};
