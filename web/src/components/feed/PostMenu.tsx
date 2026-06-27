import { useEffect, useState } from "react";
import { reportPost, wasReported } from "../../feed/feedApi";
import { PlatformApiError } from "../../feed/platformApi";
import { ActionMenu } from "./ActionMenu";

interface PostMenuProps {
  postId: string;
}

export function PostMenu({ postId }: PostMenuProps) {
  const [reported, setReported] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    void wasReported("post", postId).then(setReported);
  }, [postId]);

  async function denunciar() {
    if (reported) return;
    try {
      await reportPost(postId, "Contenido inapropiado o spam");
      setReported(true);
      setToast("Denuncia enviada.");
    } catch (err) {
      setToast(
        err instanceof PlatformApiError && err.status === 404
          ? "Las denuncias estarán disponibles cuando el backend exponga el endpoint."
          : "No se pudo enviar la denuncia.",
      );
    }
    window.setTimeout(() => setToast(""), 2800);
  }

  return (
    <>
      <ActionMenu
        label="Opciones de la publicación"
        items={[
          {
            id: "report",
            label: reported ? "Denunciado" : "Denunciar",
            destructive: true,
            disabled: reported,
            onSelect: () => void denunciar(),
          },
        ]}
      />
      {toast && (
        <p className="post-menu__toast" role="status">
          {toast}
        </p>
      )}
    </>
  );
}
