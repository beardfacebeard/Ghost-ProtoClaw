"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

import { fetchWithCsrf } from "@/lib/api/csrf-client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { AdCloneProjectCard } from "./AdCloneProjectCard";
import { AdCloneProjectDetail } from "./AdCloneProjectDetail";
import { AdCloneProductCard } from "./AdCloneProductCard";
import { AdCloneBrandCard } from "./AdCloneBrandCard";

/* ---------- Types ---------- */

type Business = { id: string; name: string };

type Product = {
  id: string;
  name: string;
  imageUrl?: string | null;
  notes?: string | null;
};

type Brand = {
  id: string;
  name: string;
  font?: string | null;
  colors?: string | null;
  website?: string | null;
};

type Project = {
  id: string;
  name: string;
  status: string;
  productId?: string | null;
  brandId?: string | null;
  inputAdUrl?: string | null;
  aiVersion1Url?: string | null;
  aiVersion2Url?: string | null;
  aiVersion3Url?: string | null;
  aiVersion4Url?: string | null;
  aiVersion5Url?: string | null;
  chosenVersionKey?: string | null;
  editRound1Notes?: string | null;
  editRound1Url?: string | null;
  editRound2Notes?: string | null;
  editRound2Url?: string | null;
  finalImageUrl?: string | null;
  videoUrl?: string | null;
  resize916Url?: string | null;
  resize11Url?: string | null;
  resize43Url?: string | null;
  createdAt: string | Date;
  product?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
};

type Tab = "projects" | "products" | "brands";

type AdClonePageClientProps = {
  businesses: Business[];
  selectedBusinessId: string;
  products: Product[];
  brands: Brand[];
  projects: Project[];
};

/* ---------- Component ---------- */

export function AdClonePageClient({
  businesses,
  selectedBusinessId,
  products: initialProducts,
  brands: initialBrands,
  projects: initialProjects,
}: AdClonePageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("projects");
  const [products, setProducts] = useState(initialProducts);
  const [brands, setBrands] = useState(initialBrands);
  const [projects, setProjects] = useState(initialProjects);

  // Dialog states
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newBrandOpen, setNewBrandOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  // Edit dialogs
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editBrand, setEditBrand] = useState<Brand | null>(null);

  // Project detail sheet
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formFont, setFormFont] = useState("");
  const [formColors, setFormColors] = useState("");
  const [formWebsite, setFormWebsite] = useState("");
  const [formProductId, setFormProductId] = useState("");
  const [formBrandId, setFormBrandId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* ---------- Business selector ---------- */

  function handleBusinessChange(businessId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("businessId", businessId);
    router.push(`${pathname}?${params.toString()}`);
  }

  /* ---------- Refresh helper ---------- */

  function refreshData() {
    router.refresh();
  }

  /* ---------- Product CRUD ---------- */

  async function createProduct() {
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetchWithCsrf("/api/admin/ad-clone/products", {
        method: "POST",
        body: JSON.stringify({
          businessId: selectedBusinessId,
          name: formName.trim(),
          notes: formNotes.trim() || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setProducts((prev) => [created, ...prev]);
        setNewProductOpen(false);
        resetForm();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function updateProduct() {
    if (!editProduct || !formName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetchWithCsrf(
        `/api/admin/ad-clone/products/${editProduct.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: formName.trim(),
            notes: formNotes.trim() || null,
          }),
        }
      );
      if (res.ok) {
        const updated = await res.json();
        setProducts((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
        setEditProduct(null);
        resetForm();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteProduct(id: string) {
    const res = await fetchWithCsrf(`/api/admin/ad-clone/products/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  }

  /* ---------- Brand CRUD ---------- */

  async function createBrand() {
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetchWithCsrf("/api/admin/ad-clone/brands", {
        method: "POST",
        body: JSON.stringify({
          businessId: selectedBusinessId,
          name: formName.trim(),
          font: formFont.trim() || null,
          colors: formColors.trim() || null,
          website: formWebsite.trim() || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setBrands((prev) => [created, ...prev]);
        setNewBrandOpen(false);
        resetForm();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function updateBrand() {
    if (!editBrand || !formName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetchWithCsrf(
        `/api/admin/ad-clone/brands/${editBrand.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: formName.trim(),
            font: formFont.trim() || null,
            colors: formColors.trim() || null,
            website: formWebsite.trim() || null,
          }),
        }
      );
      if (res.ok) {
        const updated = await res.json();
        setBrands((prev) =>
          prev.map((b) => (b.id === updated.id ? updated : b))
        );
        setEditBrand(null);
        resetForm();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteBrand(id: string) {
    const res = await fetchWithCsrf(`/api/admin/ad-clone/brands/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setBrands((prev) => prev.filter((b) => b.id !== id));
    }
  }

  /* ---------- Project CRUD ---------- */

  async function createProject() {
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetchWithCsrf("/api/admin/ad-clone/projects", {
        method: "POST",
        body: JSON.stringify({
          businessId: selectedBusinessId,
          name: formName.trim(),
          productId: formProductId || null,
          brandId: formBrandId || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setProjects((prev) => [created, ...prev]);
        setNewProjectOpen(false);
        resetForm();
      }
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- Helpers ---------- */

  function resetForm() {
    setFormName("");
    setFormNotes("");
    setFormFont("");
    setFormColors("");
    setFormWebsite("");
    setFormProductId("");
    setFormBrandId("");
  }

  function openEditProduct(product: Product) {
    setFormName(product.name);
    setFormNotes(product.notes ?? "");
    setEditProduct(product);
  }

  function openEditBrand(brand: Brand) {
    setFormName(brand.name);
    setFormFont(brand.font ?? "");
    setFormColors(brand.colors ?? "");
    setFormWebsite(brand.website ?? "");
    setEditBrand(brand);
  }

  function openProjectDetail(project: Project) {
    setDetailProject(project);
    setDetailOpen(true);
  }

  /* ---------- Tab buttons ---------- */

  const TABS: { key: Tab; label: string }[] = [
    { key: "projects", label: "Projects" },
    { key: "products", label: "Products" },
    { key: "brands", label: "Brands" },
  ];

  const newButtonLabels: Record<Tab, string> = {
    projects: "New Project",
    products: "New Product",
    brands: "New Brand",
  };

  function handleNewClick() {
    resetForm();
    if (tab === "projects") setNewProjectOpen(true);
    if (tab === "products") setNewProductOpen(true);
    if (tab === "brands") setNewBrandOpen(true);
  }

  /* ---------- Render ---------- */

  return (
    <>
      {/* Business selector */}
      {businesses.length > 1 && (
        <div className="mb-4">
          <Select
            value={selectedBusinessId}
            onValueChange={handleBusinessChange}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select business" />
            </SelectTrigger>
            <SelectContent>
              {businesses.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Tab bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-slate-800/50 p-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === key
                  ? "bg-slate-700 text-white"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={handleNewClick}>
          <Plus className="mr-1.5 h-4 w-4" />
          {newButtonLabels[tab]}
        </Button>
      </div>

      {/* Tab content */}
      {tab === "projects" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.length === 0 ? (
            <p className="col-span-full py-12 text-center text-sm text-ink-muted">
              No projects yet. Click &quot;New Project&quot; to get started.
            </p>
          ) : (
            projects.map((project) => (
              <AdCloneProjectCard
                key={project.id}
                project={project}
                onClick={() => openProjectDetail(project)}
              />
            ))
          )}
        </div>
      )}

      {tab === "products" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.length === 0 ? (
            <p className="col-span-full py-12 text-center text-sm text-ink-muted">
              No products yet. Click &quot;New Product&quot; to add one.
            </p>
          ) : (
            products.map((product) => (
              <AdCloneProductCard
                key={product.id}
                product={product}
                onEdit={openEditProduct}
                onDelete={deleteProduct}
              />
            ))
          )}
        </div>
      )}

      {tab === "brands" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.length === 0 ? (
            <p className="col-span-full py-12 text-center text-sm text-ink-muted">
              No brands yet. Click &quot;New Brand&quot; to add one.
            </p>
          ) : (
            brands.map((brand) => (
              <AdCloneBrandCard
                key={brand.id}
                brand={brand}
                onEdit={openEditBrand}
                onDelete={deleteBrand}
              />
            ))
          )}
        </div>
      )}

      {/* ===== New Product Dialog ===== */}
      <Dialog open={newProductOpen} onOpenChange={setNewProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-ink-secondary">
                Name <span className="text-red-400">*</span>
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Product name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-secondary">
                Notes
              </label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Optional notes about this product"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewProductOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={createProduct}
              disabled={!formName.trim() || submitting}
            >
              {submitting ? "Creating..." : "Create Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Edit Product Dialog ===== */}
      <Dialog
        open={!!editProduct}
        onOpenChange={(open) => {
          if (!open) {
            setEditProduct(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-ink-secondary">
                Name <span className="text-red-400">*</span>
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Product name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-secondary">
                Notes
              </label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditProduct(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={updateProduct}
              disabled={!formName.trim() || submitting}
            >
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== New Brand Dialog ===== */}
      <Dialog open={newBrandOpen} onOpenChange={setNewBrandOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Brand</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-ink-secondary">
                Name <span className="text-red-400">*</span>
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Brand name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-secondary">
                Font
              </label>
              <Input
                value={formFont}
                onChange={(e) => setFormFont(e.target.value)}
                placeholder="e.g. Inter, Helvetica"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-secondary">
                Colors (comma-separated hex)
              </label>
              <Input
                value={formColors}
                onChange={(e) => setFormColors(e.target.value)}
                placeholder="#FF5733, #33FF57, #3357FF"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-secondary">
                Website
              </label>
              <Input
                value={formWebsite}
                onChange={(e) => setFormWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewBrandOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={createBrand}
              disabled={!formName.trim() || submitting}
            >
              {submitting ? "Creating..." : "Create Brand"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Edit Brand Dialog ===== */}
      <Dialog
        open={!!editBrand}
        onOpenChange={(open) => {
          if (!open) {
            setEditBrand(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Brand</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-ink-secondary">
                Name <span className="text-red-400">*</span>
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Brand name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-secondary">
                Font
              </label>
              <Input
                value={formFont}
                onChange={(e) => setFormFont(e.target.value)}
                placeholder="e.g. Inter, Helvetica"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-secondary">
                Colors (comma-separated hex)
              </label>
              <Input
                value={formColors}
                onChange={(e) => setFormColors(e.target.value)}
                placeholder="#FF5733, #33FF57, #3357FF"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-secondary">
                Website
              </label>
              <Input
                value={formWebsite}
                onChange={(e) => setFormWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditBrand(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={updateBrand}
              disabled={!formName.trim() || submitting}
            >
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== New Project Dialog ===== */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-ink-secondary">
                Name <span className="text-red-400">*</span>
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Project name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-secondary">
                Product
              </label>
              <Select
                value={formProductId}
                onValueChange={setFormProductId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-secondary">
                Brand
              </label>
              <Select value={formBrandId} onValueChange={setFormBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select brand (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewProjectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={createProject}
              disabled={!formName.trim() || submitting}
            >
              {submitting ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Project Detail Sheet ===== */}
      {detailProject && (
        <AdCloneProjectDetail
          project={detailProject}
          products={products}
          brands={brands}
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) setDetailProject(null);
          }}
          onUpdated={refreshData}
        />
      )}
    </>
  );
}
