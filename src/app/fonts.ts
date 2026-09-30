import localFont from "next/font/local";

/** Archivo variable (OFL), weight 100–900 and width 62–125 %, exposed as --font-archivo. Body, tables, forms. */
export const archivo = localFont({
  src: "./fonts/Archivo-Variable.ttf",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

/** Bebas Neue (OFL), capitals only, exposed as --font-bebas. Titles, labels, buttons, badges, scoreboard. */
export const bebas = localFont({
  src: "./fonts/BebasNeue-Regular.ttf",
  variable: "--font-bebas",
  weight: "400",
  display: "swap",
});
