"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

/** Loaded lazily (next/dynamic) so the editor bundle only ships when a task opens. */
export default function DescriptionEditor({
  value,
  placeholder,
  editable,
  onChange,
}: {
  value: JSONContent | null;
  placeholder: string;
  editable: boolean;
  onChange: (doc: JSONContent | null) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [2] }, link: { openOnClick: true, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value ?? undefined,
    editorProps: { attributes: { class: "tiptap text-base leading-relaxed", "aria-label": placeholder } },
    onUpdate: ({ editor: e }) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => latest.current(e.isEmpty ? null : e.getJSON()), 700);
    },
  });

  // Access can change while the panel is open (project archived, role changed).
  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(
    () => () => {
      // Flush a pending save when the panel closes.
      if (timer.current && editor) {
        clearTimeout(timer.current);
        latest.current(editor.isEmpty ? null : editor.getJSON());
      }
    },
    [editor],
  );

  return <EditorContent editor={editor} />;
}
