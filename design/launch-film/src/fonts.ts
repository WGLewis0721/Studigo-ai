import { continueRender, delayRender, staticFile } from "remotion";
let done = false;
export const loadFonts = () => {
  if (done) return; done = true;
  const h = delayRender("fonts");
  Promise.all([
    new FontFace("Bricolage Grotesque", `url(${staticFile("fonts/Bricolage.ttf")})`, { weight: "200 800" }).load(),
    new FontFace("Figtree", `url(${staticFile("fonts/Figtree.ttf")})`, { weight: "300 900" }).load(),
  ]).then((fs) => { fs.forEach((f) => document.fonts.add(f)); continueRender(h); }).catch((e) => { console.error(e); continueRender(h); });
};
