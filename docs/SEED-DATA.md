# Database Seed Data Summary

## Overview
The database has been populated with comprehensive test data to help with development and testing.

## Data Created

### Users (4)
1. **Admin Yönetici** - `admin@legalcrm.local` (ADMIN)
2. **Avukat Mehmet Yılmaz** - `lawyer@legalcrm.local` (LAWYER)
3. **Avukat Ayşe Kaya** - `lawyer2@legalcrm.local` (LAWYER)
4. **Hukuk Asistanı Zeynep Demir** - `paralegal@legalcrm.local` (PARALEGAL)

### Contacts (8)
1. **Jane Doe** - LEAD, Personal Injury (Ankara)
2. **Ahmet Öztürk** - CLIENT, Corporate Law (İstanbul) - Öztürk İnşaat A.Ş.
3. **Elif Yıldız** - CLIENT, Family Law (İzmir)
4. **Can Aydın** - LEAD, Employment Law (Ankara) - TechStart Yazılım Ltd.
5. **Deniz Şahin** - LEAD, Real Estate (İstanbul)
6. **Merve Çelik** - CLIENT, Criminal Law (İzmir)
7. **Burak Arslan** - LEAD, Tax Law (İstanbul) - Arslan Danışmanlık
8. **Selin Korkmaz** - CLIENT, Intellectual Property (Ankara)

### Matters (6)
1. **Doe vs. Corp. - İş Kazası Tazminatı** (Civil)
   - Court: Ankara 10. İş Mahkemesi
   - Estimated Value: ₺150,000
   - Owner: Admin
   - Opened: 30 days ago

2. **Öztürk İnşaat - Sözleşme İncelemesi** (Corporate)
   - Estimated Value: ₺50,000
   - Owner: Lawyer 1
   - Opened: 15 days ago

3. **Yıldız - Boşanma Davası** (Family)
   - Court: İzmir 3. Aile Mahkemesi
   - Estimated Value: ₺75,000
   - Owner: Lawyer 2
   - Opened: 60 days ago

4. **TechStart - İşçi Tazminatı Davası** (Employment)
   - Court: Ankara 15. İş Mahkemesi
   - Estimated Value: ₺100,000
   - Owner: Lawyer 1
   - Opened: 7 days ago

5. **Çelik - Ceza Davası** (Criminal)
   - Court: İzmir 7. Ağır Ceza Mahkemesi
   - Estimated Value: ₺200,000
   - Owner: Admin
   - Opened: 45 days ago

6. **Korkmaz - Patent Başvurusu** (Intellectual Property)
   - Estimated Value: ₺35,000
   - Owner: Lawyer 2
   - Opened: 10 days ago

### Events (4)
1. **İlk müşteri görüşmesi - Jane Doe** (in 2 days)
   - Location: Ofis - Toplantı Odası 1
   - Organizer: Admin

2. **Duruşma - Yıldız Boşanma Davası** (in 7 days)
   - Location: İzmir 3. Aile Mahkemesi - Duruşma Salonu 2
   - Organizer: Lawyer 2

3. **Sözleşme İmza Toplantısı - Öztürk İnşaat** (in 3 days)
   - Location: Öztürk İnşaat Ofisi
   - Organizer: Lawyer 1

4. **Ön İnceleme Duruşması - Çelik Ceza Davası** (in 14 days)
   - Location: İzmir 7. Ağır Ceza Mahkemesi
   - Organizer: Admin

### Tasks (6)
1. **İlk görüşmeyi planla** (HIGH priority, due in 1 day)
   - Matter: Doe vs. Corp.
   - Assignee: Admin
   - Has checklist with 3 items

2. **Dosya ön incelemesi yap** (MEDIUM priority, due in 5 days)
   - Matter: Doe vs. Corp.
   - Assignee: Lawyer 1

3. **Sözleşme taslağı hazırla** (HIGH priority, due in 2 days)
   - Matter: Öztürk İnşaat
   - Assignee: Lawyer 1

4. **Boşanma dilekçesi hazırla** (HIGH priority, due in 3 days)
   - Matter: Yıldız Boşanma
   - Assignee: Lawyer 2

5. **Tanık listesi hazırla** (MEDIUM priority, due in 10 days)
   - Matter: Çelik Ceza Davası
   - Assignee: Paralegal

6. **Patent başvuru belgelerini kontrol et** (MEDIUM priority, due in 4 days)
   - Matter: Korkmaz Patent
   - Assignee: Paralegal
   - Has checklist with 3 items

### Documents (6)
1. **dilekce-doe.pdf** - İş kazası dilekçesi
2. **sozlesme-taslak-ozturk.docx** - Sözleşme taslağı
3. **evlilik-cüzdanı-yildiz.pdf** - Evlilik belgesi
4. **is-sozlesmesi-techstart.pdf** - İş sözleşmesi
5. **iddianame-celik.pdf** - Ceza davası iddianamesi
6. **patent-basvuru-korkmaz.pdf** - Patent başvuru belgeleri

### Workflows (1)
1. **Discovery Kickoff** - 5-step workflow template with active instance
   - Steps include: Checklist, Lawyer approval, Client signature, Document request, Payment

## Usage

### Running the Seed
```bash
# Use the default seed (basic data)
npx prisma db seed

# Use the enhanced seed (comprehensive data)
npx tsx prisma/seed-enhanced.ts

# Reset database and run seed
npx prisma migrate reset --force
```

### Checking Data Counts
```bash
npx tsx scripts/count-records.ts
```

### Accessing the Data
The seed data includes:
- Multiple users with different roles for testing RBAC
- Variety of contacts (LEADs and CLIENTs) with complete address information
- Matters with estimated values and court information
- Upcoming and past events across different calendars
- Tasks with various priorities and due dates
- Documents with proper MIME types and tags
- Active workflow instance for testing workflow functionality

## Test Scenarios

You can use this data to test:

1. **Dashboard**: View overview of matters, tasks, and upcoming events
2. **Contacts Page**: Browse LEADs and CLIENTs, filter by status/tags
3. **Matters Page**: See different matter types with financial tracking
4. **Tasks Page**: View assigned tasks by priority and due date
5. **Calendar**: Check events across multiple calendars
6. **Documents**: Browse documents by matter or contact
7. **Workflows**: Test workflow execution with the active instance
8. **RBAC**: Test permission system with different user roles

## Login Credentials

All seeded users have no password set. You'll need to:
1. Set passwords via the invite system, or
2. Manually update passwords in the database for testing

## Notes

- All data is in Turkish language (as per the CRM's target market)
- Address data includes Turkish cities and proper formatting
- Financial values are in Turkish Lira (estimatedValue fields)
- Dates are relative to the seed execution time
- All storage keys are mock paths (files don't actually exist)

## Customization

To modify the seed data:
1. Edit `prisma/seed-enhanced.ts`
2. Run the seed again: `npx tsx prisma/seed-enhanced.ts`

The seed file uses `upsert` for users, so running it multiple times won't create duplicates for users but will create new records for other entities.
