// Eminent Marketing Engine — built-in template engine. No external AI key needed.
import { formatNaira } from "./business";

export type Tone = "friendly" | "luxury" | "urgent";
export type CopyInput = {
  product: string;
  price: number | null;
  category: string;
  business: string;
  phone: string;
  tone: Tone;
  offer: string;
};

const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length];

const HOOKS: Record<Tone, string[]> = {
  friendly: ["Hello fam! 👋", "Good news! 😊", "You asked, we delivered! 💛", "Fresh in store! ✨"],
  luxury: ["Elegance, redefined. ✨", "For those who settle for nothing less. 👑", "Quality you can feel. 💎", "Premium. Timeless. Yours."],
  urgent: ["🚨 Limited stock alert!", "⏰ Don't miss out!", "🔥 Selling fast!", "Last chance! ⚡"],
};

const CLOSERS: Record<Tone, string[]> = {
  friendly: ["Send us a DM or WhatsApp to order. We deliver! 🚚", "Order today and let's make you smile 😊", "Tap the link or message us to grab yours!"],
  luxury: ["Reserve yours today — limited pieces available.", "Message us for a private order.", "Treat yourself. You deserve it."],
  urgent: ["Order NOW before it's gone!", "First come, first served — message us today!", "Slide into our DM right now! 🏃"],
};

const TAGS: Record<string, string> = {
  Fashion: "#NaijaFashion #PHVendor #StyleInspo",
  Beauty: "#NaijaBeauty #SkincareNigeria #GlowUp",
  Hair: "#NaijaHair #HairVendor #WigsInLagos",
  "Shoes & Bags": "#ShoesNigeria #BagsInPH #Accessories",
  "Food & Drinks": "#NaijaFood #PHFoodie #ChopLife",
  Electronics: "#GadgetsNigeria #TechDeals #PHGadgets",
  Home: "#HomeDecorNigeria #HomeEssentials",
  Services: "#SmallBusinessNigeria #SupportLocal",
  Other: "#SupportSmallBusiness #MadeInNigeria",
};

function priceLine(price: number | null) {
  return price && price > 0 ? `Price: ${formatNaira(price)}` : "Price: DM for price";
}

export function generateCaption(i: CopyInput, seed = Date.now()) {
  const offer = i.offer.trim() ? `\n🎁 ${i.offer.trim()}` : "";
  return [
    `${pick(HOOKS[i.tone], seed)}`,
    ``,
    `Introducing ${i.product} from ${i.business || "our store"}.`,
    `${priceLine(i.price)}${offer}`,
    ``,
    pick(CLOSERS[i.tone], seed + 1),
    i.phone ? `📞 ${i.phone}` : "",
    ``,
    `${TAGS[i.category] ?? TAGS.Other} #EminentBusinessHub`,
  ]
    .filter((l, idx, arr) => !(l === "" && arr[idx - 1] === ""))
    .join("\n")
    .trim();
}

export function generateWhatsApp(i: CopyInput, seed = Date.now()) {
  const greet = pick(["Hello 👋", "Hi dear 😊", "Good day!"], seed);
  const offer = i.offer.trim() ? `\n🎁 *${i.offer.trim()}*` : "";
  return [
    `${greet}`,
    ``,
    `*${i.product}* is now available at *${i.business || "our store"}*.`,
    `💰 ${priceLine(i.price)}${offer}`,
    ``,
    i.tone === "urgent" ? "Only a few left — reply *YES* to reserve yours now!" : "Reply *YES* to order or ask any question. We deliver nationwide 🚚",
    i.phone ? `\n📞 Call/WhatsApp: ${i.phone}` : "",
  ]
    .join("\n")
    .trim();
}

export function generateFlyer(i: CopyInput, seed = Date.now()) {
  const headline =
    i.tone === "luxury"
      ? `${i.product.toUpperCase()} — PREMIUM COLLECTION`
      : i.tone === "urgent"
        ? `HOT DEAL: ${i.product.toUpperCase()}`
        : `NOW AVAILABLE: ${i.product.toUpperCase()}`;
  return [
    `HEADLINE: ${headline}`,
    `SUB-HEADLINE: ${pick(["Quality you can trust", "Your style, your way", "Made to impress", "Value that speaks"], seed)}`,
    `PRICE: ${i.price && i.price > 0 ? formatNaira(i.price) : "Call for price"}`,
    i.offer.trim() ? `OFFER: ${i.offer.trim()}` : `OFFER: Free delivery within Port Harcourt`,
    `CALL TO ACTION: ${i.tone === "urgent" ? "Order today — limited stock!" : "Order now on WhatsApp"}`,
    `CONTACT: ${i.business || "Our store"}${i.phone ? ` • ${i.phone}` : ""}`,
    `FOOTER: Powered by Eminent Business Hub`,
  ].join("\n");
}
