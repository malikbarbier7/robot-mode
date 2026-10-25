/**
 * The site itself, as the rest of the web sees it: its address, how it
 * introduces itself in search results and link previews, and who publishes it.
 *
 * The address comes from NEXT_PUBLIC_SITE_URL at build time (set it on the
 * host to point a preview deploy elsewhere). Without it, links in previews and
 * the sitemap point at the live site.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.getrobotmode.com").replace(/\/+$/, "")

export const SITE_NAME = "Robot Mode"

/** The value proposition, a line per beat. The landing page's headline and the share image both use it. */
export const VALUE_PROP = ["Tell it what you want to do.", "It finds the time."] as const

/** What it is, in the words people search for: the line under the headline. */
export const CATEGORY = "A free automatic weekly schedule maker that runs in your browser."

/** The three things it costs nothing to try: on the key, and under the final one. */
export const TERMS = "Free · Private · No account"

/** Search results and link previews: what it is, in a sentence. */
export const SITE_TITLE = `${SITE_NAME} · Free automatic weekly schedule maker`
export const SITE_DESCRIPTION =
  "A free, automatic weekly schedule maker. List what you want to do each week; Robot Mode finds the time for every session, around your sleep, meals and fixed hours. No AI, no account: it runs in your browser."

/**
 * Who publishes the site, for the legal notice and the privacy page (in
 * France, the "mentions légales"). Published by an individual: without a name,
 * the notice says so, and the contact is the handle on X. A host left empty
 * shows as missing, so nothing goes out half-filled by accident.
 */
export const PUBLISHER = {
  /** Your full name, or your company's. */
  name: "",
  /** A postal address (for an individual, it may be kept private with the host, but an address is still expected). */
  address: "",
  /** Where people can reach you: also shown as Contact in the footers once set. */
  email: "",
  /** The publisher's handle on X, without the @: the public way to reach them, shown as Built by in the footers. */
  x: "malikbuilds",
}

/** The publisher's profile on X. */
export const PUBLISHER_X_URL = `https://x.com/${PUBLISHER.x}`

/** Where the static site is hosted (also part of the legal notice). */
export const HOST = {
  name: "Cloudflare, Inc.",
  address: "101 Townsend St, San Francisco, CA 94107, USA",
}
