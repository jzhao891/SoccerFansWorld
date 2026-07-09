import { getAllFrameTemplates } from "@/lib/frames/loadFrames";
import FrameStudioClient from "./FrameStudioClient";

// Server Component: the frame list is read from disk (today's limited-edition
// matches + evergreen frames — see lib/frames/loadFrames.ts), which requires
// `fs` and can't run in a "use client" component. Fetch here, hand the
// resolved list down as a prop; all the interactive UI lives in
// FrameStudioClient.
export default async function CardFramePage() {
  const frames = await getAllFrameTemplates();
  return <FrameStudioClient frames={frames} />;
}
