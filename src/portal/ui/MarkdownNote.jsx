/* MarkdownNote.jsx — the heavy markdown renderer, isolated so it can be
   lazy-loaded. react-markdown + remark-gfm pull in the unified/remark/micromark
   stack (~100KB gz); keeping them behind a dynamic import() means the public
   poster and the rest of the portal never pay for them. This module is only
   ever reached via Markdown (ui.jsx), which React.lazy()s it.

   Safety: react-markdown renders to React elements, never raw HTML — no
   dangerouslySetInnerHTML, so untrusted note text can't inject markup. We also
   do NOT enable rehype-raw, so embedded <script>/<html> stays inert as text.

   Links are forced to open in a new tab with rel="noopener" since notes often
   cite external sources. */

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const COMPONENTS = {
  a: (props) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" />,
};

export default function MarkdownNote({ source }) {
  return (
    <div className="md">
      <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {source || ''}
      </Markdown>
    </div>
  );
}
