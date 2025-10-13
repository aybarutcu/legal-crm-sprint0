import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ParentType, Role } from "@prisma/client";
import { InviteClientButton } from "@/components/contact/InviteClientButton";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

type ContactDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ContactDetailPage({
  params,
}: ContactDetailPageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          invitedAt: true,
          activatedAt: true,
          isActive: true,
        },
      },
    },
  });

  if (!contact) {
    notFound();
  }

  const [matterLinks, notes] = await Promise.all([
    prisma.matterContact.findMany({
      where: { contactId: id },
      include: {
        matter: {
          select: { id: true, title: true, status: true, openedAt: true },
        },
      },
    }),
    prisma.note.findMany({
      where: { parentType: ParentType.CONTACT, parentId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const matters = matterLinks.map((link) => ({
    id: link.matter.id,
    title: link.matter.title,
    status: link.matter.status,
    openedAt: link.matter.openedAt,
    role: link.role,
  }));

  const canInvite =
    session.user.role === Role.ADMIN || session.user.role === Role.LAWYER;
  const contactEmail = contact.email ?? null;
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const portalUser = contact.user;
  const isActivated = Boolean(portalUser?.activatedAt);
  const hasInvite = Boolean(portalUser?.invitedAt);
  const portalStatus = portalUser?.activatedAt
    ? `Aktif • ${dateFormatter.format(portalUser.activatedAt)}`
    : portalUser?.invitedAt
      ? `Davet gönderildi • ${dateFormatter.format(portalUser.invitedAt)}`
      : "Davet gönderilmedi";
  const inviteDisabledReason =
    !contactEmail
      ? "E-posta adresi olmadığı için davet gönderilemez."
      : portalUser && portalUser.role !== Role.CLIENT
        ? "Bu kişi portal dışında farklı bir rol ile eşleştirilmiş."
        : null;

  return (
    <div className="space-y-6" data-testid="contact-detail">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Contact Detail</p>
          <h2 className="text-2xl font-semibold text-slate-900">
            {contact.firstName} {contact.lastName}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {canInvite ? (
            <InviteClientButton
              fullName={fullName}
              email={contactEmail}
              isActivated={isActivated}
              hasInvite={hasInvite}
              disabledReason={inviteDisabledReason}
            />
          ) : null}
          <Link
            href="/contacts"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Tüm Contacts
          </Link>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Genel Bilgiler</h3>
          <dl className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-500">E-posta</dt>
              <dd>{contact.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Telefon</dt>
              <dd>{contact.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Tip</dt>
              <dd>{contact.type}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Durum</dt>
              <dd>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {contact.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Sahip</dt>
              <dd>{contact.owner?.name ?? contact.owner?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Oluşturma</dt>
              <dd>{dateFormatter.format(contact.createdAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium text-slate-500">Etiketler</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {contact.tags.length ? (
                  contact.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-accent/10 px-2 py-1 text-xs text-accent"
                    >
                      #{tag}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Portal Daveti</dt>
              <dd className="text-slate-600">{portalStatus}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">İlgili Matters</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {matters.length ? (
              matters.map((matter) => (
                <li key={matter.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="font-medium text-slate-900">{matter.title}</div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    {matter.status} · {matter.role}
                  </div>
                </li>
              ))
            ) : (
              <li className="text-slate-400">Bağlı matter bulunmuyor.</li>
            )}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h3 className="text-lg font-semibold text-slate-900">Notlar</h3>
        <p className="mt-1 text-sm text-slate-500">
          Sprint 1 için liste placeholder. Not ekleme akışı v2&apos;de tamamlanacak.
        </p>
        <ul className="mt-4 space-y-4 text-sm text-slate-600">
          {notes.length ? (
            notes.map((note) => (
              <li key={note.id}>
                <div className="text-xs uppercase tracking-widest text-slate-400">
                  {dateFormatter.format(note.createdAt)}
                </div>
                <p className="mt-1 whitespace-pre-wrap">{note.body}</p>
              </li>
            ))
          ) : (
            <li className="text-slate-400">Henüz not bulunmuyor.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
