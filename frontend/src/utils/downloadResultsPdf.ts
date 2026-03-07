import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type RGB = [number, number, number];

const NAVY: RGB    = [15, 23, 42];
const BLUE: RGB    = [37, 99, 235];
const BLUE_LIGHT: RGB = [239, 246, 255];
const BLUE_MID: RGB   = [191, 219, 254];
const GRAY_DARK: RGB  = [51, 65, 85];
const GRAY_MID: RGB   = [148, 163, 184];
const GRAY_LIGHT: RGB = [248, 250, 252];
const WHITE: RGB   = [255, 255, 255];
const DARK: RGB    = [15, 23, 42];
const RED: RGB     = [220, 38, 38];
const GREEN: RGB   = [21, 128, 61];

export function downloadResultsPdf(results: any, selectedSem: string) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageW - margin * 2;

    const info = results.student_info || {};
    const dateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
    });

    /* ── HEADER ─────────────────────────────────────────────────────────── */
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 40, 'F');
    doc.setFillColor(...BLUE);
    doc.rect(0, 36, pageW, 4, 'F');

    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('GURU GOBIND SINGH INDRAPRASTHA UNIVERSITY', pageW / 2, 12, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Sector 16C, Dwarka, New Delhi – 110078  |  examweb.ggsipu.ac.in', pageW / 2, 19, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('ACADEMIC RESULT TRANSCRIPT', pageW / 2, 28, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(191, 219, 254);
    doc.text(`Generated: ${dateStr}`, pageW - margin, 35, { align: 'right' });

    /* ── STUDENT INFO BOX ───────────────────────────────────────────────── */
    let y = 48;

    doc.setFillColor(...BLUE_LIGHT);
    doc.setDrawColor(...BLUE_MID);
    doc.roundedRect(margin, y, contentW, 38, 2, 2, 'FD');

    doc.setTextColor(...BLUE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('STUDENT INFORMATION', margin + 4, y + 6);

    const c1 = margin + 4;
    const c1v = c1 + 28;
    const c2 = margin + 4 + 96;
    const c2v = c2 + 28;
    const lh = 6.2;

    const infoRows: [string, string, string, string][] = [
        ['Name', info.name || '---', 'Enrollment No.', results.enrollment_number || '---'],
        ['Programme', shortenProgramme(info.programme || '---'), 'Batch', info.batch || '---'],
        ['Institution', shortenInst(info.institution || '---'), 'CGPA', results.cgpa ? parseFloat(results.cgpa).toFixed(2) : '---'],
        ["Father's Name", info.father || '---', "Mother's Name", info.mother || '---'],
        ['Gender', info.gender || '---', 'Admission Year', info.admission_year || '---'],
    ];

    let iy = y + 12;
    for (const [l1, v1, l2, v2] of infoRows) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...GRAY_MID);
        doc.text(l1 + ':', c1, iy);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...DARK);
        doc.text(String(v1), c1v, iy);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...GRAY_MID);
        doc.text(l2 + ':', c2, iy);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...DARK);
        doc.text(String(v2), c2v, iy);

        iy += lh;
    }

    y += 43;

    /* ── DETERMINE SEMESTERS ────────────────────────────────────────────── */
    const allSems: any[] = results.semesters || [];
    const semsToRender = selectedSem === 'overall'
        ? allSems
        : allSems.filter(s => {
              const num = s.semester_num ?? s.semester;
              return String(num) === selectedSem;
          });

    /* ── RENDER EACH SEMESTER ───────────────────────────────────────────── */
    for (const sem of semsToRender) {
        if (y > pageH - 55) { doc.addPage(); y = 14; }

        const semNum = sem.semester_num ?? sem.semester;
        const rawLabel = sem.semester_label || (semNum ? `Semester ${semNum}` : 'Semester');

        // Semester header bar
        doc.setFillColor(...GRAY_DARK);
        doc.rect(margin, y, contentW, 8, 'F');
        doc.setTextColor(...WHITE);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        const semLabel = rawLabel.toUpperCase();
        doc.text(semLabel, margin + 4, y + 5.5);

        const sgpaVal = sem.sgpa ? parseFloat(sem.sgpa) : 0;
        if (sgpaVal > 0) {
            doc.text(`SGPA: ${sgpaVal.toFixed(2)}`, pageW - margin - 4, y + 5.5, { align: 'right' });
        }
        y += 11;

        const subjects = sem.subjects || [];
        const tableBody = subjects.map((sub: any, idx: number) => {
            const isPending = sub.is_pending || sub.grade === '-' || sub.total_marks === null || sub.total_marks === undefined;
            const totalDisp = isPending ? 'Pending' : (sub.total_marks ?? '-');
            const maxDisp = isPending ? '---' : (sub.max_marks ?? 100);
            return [
                idx + 1,
                sub.code || '---',
                sub.name || '---',
                sub.internal ?? '-',
                sub.external ?? '-',
                totalDisp,
                maxDisp,
                sub.grade || '-',
                sub.status || '-',
            ];
        });

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['#', 'Paper Code', 'Subject Name', 'Int', 'Ext', 'Total', 'Max', 'Grade', 'Status']],
            body: tableBody,
            theme: 'grid',
            headStyles: {
                fillColor: [55, 65, 81],
                textColor: [255, 255, 255],
                fontSize: 7.5,
                fontStyle: 'bold',
                halign: 'center' as const,
                cellPadding: 2.5,
            },
            bodyStyles: {
                fontSize: 7.5,
                textColor: [30, 30, 30],
                cellPadding: 2,
            },
            columnStyles: {
                0: { halign: 'center' as const, cellWidth: 7 },
                1: { halign: 'center' as const, cellWidth: 24 },
                2: { halign: 'left' as const, cellWidth: 68 },
                3: { halign: 'center' as const, cellWidth: 11 },
                4: { halign: 'center' as const, cellWidth: 11 },
                5: { halign: 'center' as const, cellWidth: 16 },
                6: { halign: 'center' as const, cellWidth: 10 },
                7: { halign: 'center' as const, cellWidth: 13 },
                8: { halign: 'center' as const, cellWidth: 22 },
            },
            alternateRowStyles: { fillColor: [...GRAY_LIGHT] },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 7) {
                    const g = String(data.cell.raw);
                    if (g === 'F') data.cell.styles.textColor = RED;
                    else if (g === 'O' || g === 'A+') data.cell.styles.textColor = GREEN;
                    else if (g === '-') data.cell.styles.textColor = GRAY_MID;
                }
            },
        });

        y = (doc as any).lastAutoTable.finalY + 6;
    }

    /* ── OVERALL SUMMARY ────────────────────────────────────────────────── */
    if (selectedSem === 'overall') {
        if (y > pageH - 50) { doc.addPage(); y = 14; }

        // SGPA progression table
        const sgpaRows = allSems
            .filter(s => s.sgpa && parseFloat(s.sgpa) > 0)
            .map(s => {
                const num = s.semester_num ?? s.semester;
                const label = s.semester_label || (num ? `Semester ${num}` : 'Semester');
                return [label, parseFloat(s.sgpa).toFixed(2)];
            });

        if (sgpaRows.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...GRAY_DARK);
            doc.text('SEMESTER-WISE PERFORMANCE SUMMARY', margin, y + 1);
            y += 5;

            autoTable(doc, {
                startY: y,
                margin: { left: margin, right: margin },
                head: [['Semester', 'SGPA']],
                body: sgpaRows,
                theme: 'striped',
                tableWidth: contentW / 2.5,
                headStyles: {
                    fillColor: GRAY_DARK,
                    textColor: WHITE,
                    fontSize: 8,
                    halign: 'center' as const,
                },
                bodyStyles: { fontSize: 8, halign: 'center' as const },
            });

            y = (doc as any).lastAutoTable.finalY + 6;
        }

        // CGPA box
        if (y > pageH - 25) { doc.addPage(); y = 14; }

        doc.setFillColor(...BLUE_LIGHT);
        doc.setDrawColor(...BLUE_MID);
        doc.roundedRect(margin, y, contentW, 22, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...BLUE);
        doc.text(
            `Cumulative GPA (CGPA): ${results.cgpa ? parseFloat(results.cgpa).toFixed(2) : '---'}`,
            pageW / 2, y + 9, { align: 'center' }
        );

        if (results.overallPercentage) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...GRAY_DARK);
            doc.text(
                `Overall Percentage (declared subjects only): ${results.overallPercentage.toFixed(1)}%`,
                pageW / 2, y + 16, { align: 'center' }
            );
        }
    }

    /* ── FOOTER ON EVERY PAGE ───────────────────────────────────────────── */
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(241, 245, 249);
        doc.rect(0, pageH - 10, pageW, 10, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...GRAY_MID);
        doc.text(
            `Generated by AcadHub  •  ${dateStr}  •  Data sourced from GGSIPU examination portal.`,
            pageW / 2, pageH - 4, { align: 'center' }
        );
        doc.text(`Page ${i} / ${totalPages}`, pageW - margin, pageH - 4, { align: 'right' });
    }

    /* ── DOWNLOAD ───────────────────────────────────────────────────────── */
    const nameSlug = (info.name || 'Student').replace(/\s+/g, '_').toUpperCase();
    const enroll = results.enrollment_number || '';
    const semPart = selectedSem === 'overall' ? 'All_Semesters' : `Sem_${selectedSem}`;
    doc.save(`${nameSlug}_${enroll}_${semPart}_Results.pdf`);
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function shortenProgramme(p: string): string {
    return p
        .replace(/BACHELOR OF TECHNOLOGY/i, 'B.TECH')
        .replace(/MASTER OF TECHNOLOGY/i, 'M.TECH')
        .replace(/BACHELOR OF/i, 'B.')
        .replace(/MASTER OF/i, 'M.')
        .substring(0, 45);
}

function shortenInst(name: string): string {
    return name.substring(0, 42);
}
