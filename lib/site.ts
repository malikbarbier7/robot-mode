/**
 * The site itself, as the rest of the web sees it: its address, how it
 * introduces itself in search results and link previews, and who publishes it.
 *
 * The address comes from NEXT_PUBLIC_SITE_URL at build time (set it on the
 * host once the domain exists, e.g. https://robotmode.app). Without it, links
 * in previews and the sitemap point at the local dev server.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "")

export const SITE_NAME = "Robot Mode"

/** The value proposition, a line per beat. The landing page's headline and the share image both use it. */
export const VALUE_PROP = ["Write your week.", "Let the robot decide.", "Print your schedule.", "Execute."] as const

/** Search results and link previews: what it is, in a sentence. */
export const SITE_TITLE = `${SITE_NAME} · Free automatic weekly schedule maker`
export const SITE_DESCRIPTION =
  "A free, automatic weekly schedule maker. Write what you want to do; Robot Mode places every session around when you wake, sleep and eat, and prints your schedule. No AI, no account: it runs in your browser."

/**
 * Who publishes the site, for the legal notice and the privacy page. Required
 * before publishing (in France, the "mentions légales"). Empty fields show as
 * missing on those pages, so nothing goes out half-filled by accident.
 */
export const PUBLISHER = {
  /** Your full name, or your company's. */
  name: "",
  /** A postal address (for an individual, it may be kept private with the host, but an address is still expected). */
  address: "",
  /** Where people can reach you: also shown as Contact in the footers once set. */
  email: "",
}

/** Where the static site is hosted (also part of the legal notice). Fill in once the host is chosen. */
export const HOST = {
  name: "",
  address: "",
}
