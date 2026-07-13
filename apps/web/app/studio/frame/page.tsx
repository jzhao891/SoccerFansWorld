import { getAllFrameTemplates } from "@/lib/frames/loadFrames";
import FrameStudioClient from "./FrameStudioClient";

// Server Component: the frame list is read from disk (today's limited-edition
// matches + evergreen frames — see lib/frames/loadFrames.ts), which requires
// `fs` and can't run in a "use client" component. Fetch here, hand the
// resolved list down as a prop; all the interactive UI lives in
// FrameStudioClient.
//
// getAllFrameTemplates() picks the daily/<today> folder via todayDate() —
// without `dynamic = "force-dynamic"`, Next has no signal this page depends
// on the current date, so it prerenders it once at BUILD time and serves
// that same static HTML forever after. "Today's" frames would then stay
// frozen on whatever day the last deploy happened, never rotating.
export const dynamic = "force-dynamic";

export default async function CardFramePage() {
  const frames = await getAllFrameTemplates();
  return <FrameStudioClient frames={frames} />;
}
