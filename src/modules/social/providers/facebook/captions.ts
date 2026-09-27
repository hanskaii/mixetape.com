import { InvalidInputError, type Caption, type CaptionsCapability } from "../types";
import { download, graph } from "../meta/graph";

/**
 * Subtitle tracks on a Page video. Facebook takes SRT files named for a Facebook locale
 * (en_US, id_ID…); one track per locale, so uploading again replaces it.
 */

const DEFAULT_REGION: Record<string, string> = {
  en: "en_US",
  id: "id_ID",
  es: "es_LA",
  pt: "pt_BR",
  fr: "fr_FR",
  de: "de_DE",
  ja: "ja_JP",
  ko: "ko_KR",
  zh: "zh_CN",
  ar: "ar_AR",
  hi: "hi_IN",
  it: "it_IT",
  nl: "nl_NL",
  ru: "ru_RU",
  th: "th_TH",
  tr: "tr_TR",
  vi: "vi_VN",
  ms: "ms_MY",
};

/** "en" → "en_US", "en-GB" → "en_GB", "en_US" stays. */
export function facebookLocale(language: string): string {
  const code = language.trim().replace("-", "_");
  if (/^[a-z]{2}_[A-Z]{2}$/.test(code)) return code;
  const region = DEFAULT_REGION[code.toLowerCase()];
  if (region) return region;
  throw new InvalidInputError(`Use a Facebook locale such as "en_US" for "${language}"`);
}

type Track = {
  locale?: string;
  locale_name?: string;
  is_default?: boolean;
  is_auto_generated?: boolean;
};

export const facebookCaptions: CaptionsCapability = {
  async list(videoId, token) {
    const data = await graph<{ data?: Track[] }>(token, `${videoId}/captions`);
    return (data.data ?? []).map((track): Caption => ({
      id: track.locale ?? "",
      language: track.locale ?? "",
      name: track.locale_name ?? "",
      kind: track.is_auto_generated ? "asr" : "standard",
    }));
  },

  async put(videoId, { language, url }, token) {
    const locale = facebookLocale(language);
    const existing = (await facebookCaptions.list(videoId, token)).some(
      (track) => track.language === locale,
    );
    const file = await (await download(url, "caption file")).arrayBuffer();
    const body = new FormData();
    // Facebook reads the locale from the file name: <name>.<locale>.srt
    body.set(
      "captions_file",
      new Blob([file], { type: "application/x-subrip" }),
      `captions.${locale}.srt`,
    );
    await graph(token, `${videoId}/captions`, { method: "POST", body });
    return { id: locale, language: locale, name: "", replaced: existing };
  },
};
