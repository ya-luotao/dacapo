// The Worker behind https://playdacapo.com (wrangler.jsonc). The app is static files, served
// before this runs; every other request (the privacy policy, profile pages, a 404) goes to the
// account service, dacapo-cloud, through a service binding.

interface Env {
  CLOUD: { fetch: (request: Request) => Promise<Response> };
}

export default {
  fetch: (request: Request, env: Env): Promise<Response> => env.CLOUD.fetch(request),
};
