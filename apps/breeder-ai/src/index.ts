export default {
  fetch(): Response {
    return Response.json(
      {
        code: "PHASE0_LOCAL_SPIKE_ONLY",
        deployed: false,
      },
      { status: 503 },
    );
  },
} satisfies ExportedHandler<Cloudflare.Env>;
