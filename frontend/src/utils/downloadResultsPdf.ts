import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type RGB = [number, number, number];

const NAVY: RGB = [15, 23, 42];
const BLUE: RGB = [37, 99, 235];
const BLUE_LIGHT: RGB = [239, 246, 255];
const BLUE_MID: RGB = [191, 219, 254];
const GRAY_DARK: RGB = [51, 65, 85];
const GRAY_MID: RGB = [148, 163, 184];
const GRAY_LIGHT: RGB = [248, 250, 252];
const WHITE: RGB = [255, 255, 255];
const DARK: RGB = [15, 23, 42];
const RED: RGB = [220, 38, 38];
const GREEN: RGB = [21, 128, 61];

function normalizeProfileInfo(info: any) {
    return {
        name: info?.name || info?.stname || '',
        roll_no: info?.roll_no || info?.nrollno || info?.enrollment_number || '',
        father: info?.father || '',
        mother: info?.mother || '',
        gender: info?.gender || '',
        email: info?.email || '',
        phone: info?.phone || info?.mobno || '',
        batch: info?.batch || info?.byoa || '',
        admission_year: info?.admission_year || info?.yoa || '',
        institution: info?.institution || info?.iname || '',
        programme: info?.programme || info?.prgname || '',
    };
}

function shortenProgramme(value: string): string {
    return value
        .replace(/BACHELOR OF TECHNOLOGY/i, 'B.TECH')
        .replace(/MASTER OF TECHNOLOGY/i, 'M.TECH')
        .replace(/BACHELOR OF/i, 'B.')
        .replace(/MASTER OF/i, 'M.')
        .slice(0, 46);
}

function shortenInst(value: string): string {
    return value.slice(0, 42);
}

function truncateText(value: string, limit: number): string {
    return value.length > limit ? `${value.slice(0, limit - 2)}..` : value;
}

function formatDeclaredDate(value: unknown): string | null {
    if (!value) return null;
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getLatestDeclaredDate(subjects: any[]): string | null {
    let latest: Date | null = null;
    for (const subject of subjects) {
        if (!subject?.declared_date) continue;
        const parsed = new Date(String(subject.declared_date));
        if (Number.isNaN(parsed.getTime())) continue;
        if (!latest || parsed > latest) latest = parsed;
    }
    if (!latest) return null;
    return latest.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getSemestersToRender(results: any, selectedSem: string) {
    const allSems = results?.semesters || [];
    return selectedSem === 'overall'
        ? allSems
        : allSems.filter((sem: any) => String(sem.semester_num ?? sem.semester) === selectedSem);
}

export function downloadResultsPdf(results: any, selectedSem: string) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageW - (margin * 2);

    const info = normalizeProfileInfo(results?.student_info || {});
    const dateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
    const semesters = getSemestersToRender(results, selectedSem);

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
    doc.text('Sector 16C, Dwarka, New Delhi | examweb.ggsipu.ac.in', pageW / 2, 19, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(selectedSem === 'overall' ? 'ACADEMIC RESULT TRANSCRIPT' : 'SEMESTER RESULT REPORT', pageW / 2, 28, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(191, 219, 254);
    doc.text(`Generated: ${dateStr}`, pageW - margin, 35, { align: 'right' });

    let y = 48;

    doc.setFillColor(...BLUE_LIGHT);
    doc.setDrawColor(...BLUE_MID);
    doc.roundedRect(margin, y, contentW, 48, 2, 2, 'FD');

    doc.setTextColor(...BLUE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('STUDENT INFORMATION', margin + 4, y + 6);

    const c1 = margin + 4;
    const c1v = c1 + 28;
    const c2 = margin + 100;
    const c2v = c2 + 28;
    const lh = 6.2;

    const infoRows: [string, string, string, string][] = [
        ['Name', info.name || '---', 'Enrollment No.', results?.enrollment_number || info.roll_no || '---'],
        ['Programme', shortenProgramme(info.programme || '---'), 'Batch', info.batch || '---'],
        ['Institution', shortenInst(info.institution || '---'), 'CGPA', results?.cgpa ? Number(results.cgpa).toFixed(2) : '---'],
        ["Father's Name", info.father || '---', "Mother's Name", info.mother || '---'],
        ['Gender', info.gender || '---', 'Admission Year', info.admission_year || '---'],
        ['Email', truncateText(info.email || '---', 34), 'Phone', info.phone || '---'],
    ];

    let iy = y + 12;
    for (const [l1, v1, l2, v2] of infoRows) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...GRAY_MID);
        doc.text(`${l1}:`, c1, iy);
        doc.text(`${l2}:`, c2, iy);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...DARK);
        doc.text(String(v1), c1v, iy);
        doc.text(String(v2), c2v, iy);
        iy += lh;
    }

    y += 53;

    for (const sem of semesters) {
        if (y > pageH - 70) {
            doc.addPage();
            y = 14;
        }

        const semNum = sem.semester_num ?? sem.semester;
        const semLabel = String(sem.semester_label || `Semester ${semNum}`).toUpperCase();
        const subjects = sem.subjects || [];
        const completedSubjects = subjects.filter((sub: any) => !sub.is_pending && sub.grade !== '-');
        const passedSubjects = completedSubjects.filter((sub: any) => String(sub.grade || '').toUpperCase() !== 'F');
        const distinctionCount = completedSubjects.filter((sub: any) => Number(sub.percentage || 0) >= 75).length;
        const semesterTotal = completedSubjects.reduce((sum: number, sub: any) => sum + Number(sub.total_marks ?? 0), 0);
        const semesterMax = completedSubjects.reduce((sum: number, sub: any) => sum + Number(sub.max_marks ?? 100), 0);
        const semesterPct = semesterMax > 0 ? ((semesterTotal / semesterMax) * 100).toFixed(1) : '0.0';
        const declaredDate = formatDeclaredDate(subjects.find((sub: any) => sub?.declared_date)?.declared_date);
        const examSession = subjects.find((sub: any) => sub?.exam_session)?.exam_session || null;
        const sgpaVal = sem.sgpa ? parseFloat(sem.sgpa) : 0;

        doc.setFillColor(...GRAY_DARK);
        doc.rect(margin, y, contentW, 8, 'F');
        doc.setTextColor(...WHITE);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(semLabel, margin + 4, y + 5.5);
        if (sgpaVal > 0) {
            doc.text(`SGPA: ${sgpaVal.toFixed(2)}`, pageW - margin - 4, y + 5.5, { align: 'right' });
        }
        y += 11;

        if (examSession || declaredDate) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...GRAY_MID);
            const meta = [examSession ? `Exam: ${examSession}` : null, declaredDate ? `Declared: ${declaredDate}` : null]
                .filter(Boolean)
                .join(' | ');
            doc.text(meta, margin, y + 2.5); // Adjusted Y to lower the text away from the header
            y += 5; // Give more space after meta
        }

        doc.setFillColor(...GRAY_LIGHT);
        doc.setDrawColor(...BLUE_MID);
        doc.roundedRect(margin, y, contentW, 12, 2, 2, 'FD');
        doc.setTextColor(...GRAY_DARK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(`Subjects: ${subjects.length}`, margin + 4, y + 7);
        doc.text(`Passed: ${passedSubjects.length}/${completedSubjects.length || subjects.length}`, margin + 36, y + 7);
        doc.text(`Distinctions: ${distinctionCount}`, margin + 78, y + 7);
        doc.text(`Marks: ${semesterTotal}/${semesterMax || 0}`, margin + 116, y + 7);
        doc.text(`Percentage: ${semesterPct}%`, pageW - margin - 4, y + 7, { align: 'right' });
        y += 15;

        const tableBody = subjects.map((sub: any, idx: number) => {
            const isPending = sub.is_pending || sub.grade === '-' || sub.total_marks === null || sub.total_marks === undefined;
            return [
                idx + 1,
                sub.code || '---',
                sub.name || '---',
                sub.internal ?? '-',
                sub.external ?? '-',
                isPending ? 'Pending' : (sub.total_marks ?? '-'),
                isPending ? '---' : (sub.max_marks ?? 100),
                sub.grade || '-',
                sub.credits || sub.status || '-',
            ];
        });

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['#', 'Paper Code', 'Subject Name', 'Int', 'Ext', 'Total', 'Max', 'Grade', 'Status/Credits']],
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
                    const grade = String(data.cell.raw);
                    if (grade === 'F') data.cell.styles.textColor = RED;
                    else if (grade === 'O' || grade === 'A+') data.cell.styles.textColor = GREEN;
                    else if (grade === '-') data.cell.styles.textColor = GRAY_MID;
                }
            },
        });

        y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (selectedSem === 'overall') {
        if (y > pageH - 45) {
            doc.addPage();
            y = 14;
        }

        const sgpaRows = (results?.semesters || [])
            .filter((sem: any) => sem.sgpa && parseFloat(sem.sgpa) > 0)
            .map((sem: any) => {
                const semNum = sem.semester_num ?? sem.semester;
                return [sem.semester_label || `Semester ${semNum}`, parseFloat(sem.sgpa).toFixed(2)];
            });

        if (sgpaRows.length) {
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

            y = (doc as any).lastAutoTable.finalY + 8;
        }

        const allSubjects = (results?.semesters || []).flatMap((sem: any) => sem.subjects || []);
        const completedSubjects = allSubjects.filter((sub: any) => !sub.is_pending && sub.grade !== '-');
        const distinctionCount = completedSubjects.filter((sub: any) => Number(sub.percentage || 0) >= 75).length;
        const latestDeclared = getLatestDeclaredDate(completedSubjects);

        doc.setFillColor(...BLUE_LIGHT);
        doc.setDrawColor(...BLUE_MID);
        doc.roundedRect(margin, y, contentW, 24, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...BLUE);
        doc.text(`Cumulative GPA (CGPA): ${results?.cgpa ? Number(results.cgpa).toFixed(2) : '---'}`, pageW / 2, y + 8, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...GRAY_DARK);
        doc.text(`Overall Percentage (declared subjects only): ${results?.overallPercentage ? Number(results.overallPercentage).toFixed(1) : '0.0'}%`, pageW / 2, y + 14, { align: 'center' });
        doc.text(`Declared Subjects: ${completedSubjects.length} | Distinctions: ${distinctionCount} | Latest Declared Date: ${latestDeclared || '---'}`, pageW / 2, y + 20, { align: 'center' });
    }

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(241, 245, 249);
        doc.rect(0, pageH - 10, pageW, 10, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...GRAY_MID);
        doc.text(`Generated by AcadHub | ${dateStr} | Data sourced from GGSIPU examination portal.`, pageW / 2, pageH - 4, { align: 'center' });
        doc.text(`Page ${i} / ${totalPages}`, pageW - margin, pageH - 4, { align: 'right' });
    }

    const nameSlug = (info.name || 'Student').replace(/\s+/g, '_').toUpperCase();
    const enroll = results?.enrollment_number || info.roll_no || '';
    const semPart = selectedSem === 'overall' ? 'All_Semesters' : `Sem_${selectedSem}`;
    doc.save(`${nameSlug}_${enroll}_${semPart}_Results.pdf`);
}
