import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type AdminPlaceholderPageProps = {
  params: {
    slug: string[];
  };
};

export default function AdminPlaceholderPage({
  params: _params
}: AdminPlaceholderPageProps) {
  notFound();
}
