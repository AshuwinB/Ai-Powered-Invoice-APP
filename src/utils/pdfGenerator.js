const PDFDocument = require('pdfkit');

const generateInvoicePDF = (invoice, settings = {}) => {
    return new Promise((resolve, reject) => {
        try {
            // Use PDF settings from user preferences
            const pdfSettings = settings.pdf || {};
            const themeSettings = settings.theme || {};

            const doc = new PDFDocument({
                size: pdfSettings.paperSize || 'A4',
                layout: pdfSettings.orientation || 'portrait',
                margin: {
                    top: pdfSettings.marginTop || 50,
                    bottom: pdfSettings.marginBottom || 50,
                    left: pdfSettings.marginLeft || 50,
                    right: pdfSettings.marginRight || 50
                }
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // Add colored border around the entire invoice
            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;
            const margin = 20;
            doc.strokeColor(themeSettings.accentColor || '#cccccc').lineWidth(1)
               .rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin)
               .stroke();

            // Header with colored underline
            doc.font(pdfSettings.fontFamily || 'Helvetica');

            // Business logo at top-left (if enabled and present)
            const logoData = settings.businessInfo?.logo || settings.invoiceLogo;
            if (pdfSettings.showLogo !== false && logoData && typeof logoData === 'string' && logoData.startsWith('data:image')) {
                try {
                    const logoBase64 = logoData.split(',')[1];
                    const logoBuffer = Buffer.from(logoBase64, 'base64');
                    doc.image(logoBuffer, 50, 40, { fit: [100, 60], align: 'left' });
                } catch (logoError) {
                    console.warn('Skipping invalid logo image:', logoError.message);
                }
            }

            doc.fontSize(20).fillColor(themeSettings.primaryColor || '#000000').text('INVOICE', { align: 'center' });
            
            // Add colored line under header
            const textWidth = doc.widthOfString('INVOICE', { fontSize: 20 });
            const textX = (doc.page.width - textWidth) / 2;
            doc.strokeColor(themeSettings.primaryColor || '#000000').lineWidth(2)
               .moveTo(textX, doc.y + 5)
               .lineTo(textX + textWidth, doc.y + 5)
               .stroke();
            
            doc.moveDown();

            // Invoice details
            doc.fillColor(themeSettings.accentColor || '#666666').fontSize(pdfSettings.fontSize || 12);
            doc.text(`Invoice Number: ${invoice.invoice_no}`, { align: 'right' });
            doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, { align: 'right' });
            doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, { align: 'right' });
            doc.moveDown();

            // From section
            doc.fillColor(themeSettings.primaryColor || '#000000').fontSize(14).text('From:', { underline: true });
            doc.fillColor('#000000').fontSize(12);
            doc.text(invoice.from.name);
            doc.text(invoice.from.email);
            doc.text(invoice.from.address1);
            if (invoice.from.address2) doc.text(invoice.from.address2);
            if (invoice.from.address3) doc.text(invoice.from.address3);
            doc.moveDown();

            // To section
            doc.fillColor(themeSettings.primaryColor || '#000000').fontSize(14).text('Bill To:', { underline: true });
            doc.fillColor('#000000').fontSize(12);
            doc.text(invoice.to.name);
            doc.text(invoice.to.email);
            doc.text(invoice.to.address1);
            if (invoice.to.address2) doc.text(invoice.to.address2);
            if (invoice.to.address3) doc.text(invoice.to.address3);
            doc.moveDown();

            // Items table
            const tableTop = doc.y;
            const itemX = 50;
            const qtyX = 300;
            const rateX = 350;
            const amountX = 450;

            // Table headers with colored background
            const headerHeight = 20;
            doc.fillColor(themeSettings.primaryColor || '#000000').rect(itemX - 5, tableTop - 2, 510, headerHeight).fill();
            doc.fillColor('#ffffff').fontSize(pdfSettings.fontSize || 12).font(`${pdfSettings.fontFamily || 'Helvetica'}-Bold`);
            doc.text('Description', itemX, tableTop);
            doc.text('Qty', qtyX, tableTop);
            doc.text('Rate', rateX, tableTop);
            doc.text('Amount', amountX, tableTop);

            // Table line
            doc.strokeColor('#000000').lineWidth(1).moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

            // Table rows
            doc.fillColor('#000000').font(pdfSettings.fontFamily || 'Helvetica');
            let yPosition = tableTop + 25;
            invoice.items.forEach(item => {
                doc.text(item.item_name, itemX, yPosition);
                doc.text(item.quantity.toString(), qtyX, yPosition);
                doc.text(`${settings.currency?.symbol || '$'}${item.price.toFixed(2)}`, rateX, yPosition);
                doc.text(`${settings.currency?.symbol || '$'}${item.total.toFixed(2)}`, amountX, yPosition);
                yPosition += 20;
            });

            const getCurrencySymbol = (code) => {
                const symbols = {
                    inr: '₹',
                    usd: '$',
                    eur: '€',
                    gbp: '£',
                    aud: 'A$',
                    cad: 'C$',
                    jpy: '¥'
                };
                if (!code) return settings.currency?.symbol || '$';
                return symbols[code.toLowerCase()] || settings.currency?.symbol || '$';
            };

            const currencySymbol = getCurrencySymbol(invoice.currency);

            // Totals section with light colored background
            const totalsStartY = yPosition - 5;
            doc.fillColor('#f8f9fa').rect(340, totalsStartY, 200, 70).fill();
            
            // Totals
            yPosition += 20;
            doc.font(`${pdfSettings.fontFamily || 'Helvetica'}-Bold`);
            doc.fillColor('#000000').text(`Subtotal: ${currencySymbol}${invoice.sub_total.toFixed(2)}`, 350, yPosition);

            if (invoice.discount > 0) {
                yPosition += 20;
                doc.fillColor('#ff0000').text(`Discount: -${currencySymbol}${invoice.discount.toFixed(2)}`, 350, yPosition);
            }

            if (invoice.tax_percentage > 0) {
                yPosition += 20;
                const taxAmount = (invoice.sub_total - invoice.discount) * invoice.tax_percentage / 100;
                doc.fillColor(themeSettings.accentColor || '#666666').text(`${settings.tax?.taxName || 'Tax'} (${invoice.tax_percentage}%): ${currencySymbol}${taxAmount.toFixed(2)}`, 350, yPosition);
            }

            yPosition += 20;
            doc.fillColor(themeSettings.primaryColor || '#000000').fontSize(14);
            doc.text(`Total: ${currencySymbol}${invoice.total.toFixed(2)} ${invoice.currency || settings.currency?.currency || 'USD'}`, 350, yPosition);

            // Notes
            if (invoice.notes) {
                yPosition += 40;
                doc.fontSize(pdfSettings.fontSize || 12).font(`${pdfSettings.fontFamily || 'Helvetica'}-Bold`);
                doc.text('Notes:', 50, yPosition);
                doc.font(pdfSettings.fontFamily || 'Helvetica');
                yPosition += 20;
                doc.text(invoice.notes, 50, yPosition, { width: 500 });
            }

            // Payment information
            if (invoice.payment_link) {
                yPosition += 40;
                doc.fontSize(pdfSettings.fontSize || 12).font(`${pdfSettings.fontFamily || 'Helvetica'}-Bold`);
                doc.fillColor(themeSettings.primaryColor || '#000000').text('Payment Information:', 50, yPosition);
                doc.font(pdfSettings.fontFamily || 'Helvetica');
                yPosition += 20;
                doc.text('Click the link below to make payment:', 50, yPosition);
                yPosition += 20;
                const linkWidth = 500;
                const linkHeight = doc.heightOfString(invoice.payment_link, { width: linkWidth });
                doc.fillColor('#007bff').text(invoice.payment_link, 50, yPosition, {
                    width: linkWidth,
                    link: invoice.payment_link,
                    underline: true,
                });
                yPosition += linkHeight + 12;
                // Note: QR code image would be added here if supported
            }

            // Status
            doc.fontSize(pdfSettings.fontSize || 12).font(`${pdfSettings.fontFamily || 'Helvetica'}-Bold`);
            doc.fillColor(themeSettings.accentColor || '#666666').text(`Status: ${invoice.status}`, 50, doc.page.height - 100);

            // Signature at bottom-right if configured in settings
            const signatureImage = settings.signature?.image;
            const signatureName = settings.signature?.name;
            const signatureY = doc.page.height - 130;
            const signatureX = doc.page.width - 210;
            if (signatureImage && typeof signatureImage === 'string' && signatureImage.startsWith('data:image')) {
                try {
                    const signatureBase64 = signatureImage.split(',')[1];
                    const signatureBuffer = Buffer.from(signatureBase64, 'base64');
                    doc.fillColor('#444444').fontSize(10).font(pdfSettings.fontFamily || 'Helvetica').text('Authorized Signature', signatureX, signatureY);
                    doc.image(signatureBuffer, signatureX, signatureY + 12, { fit: [140, 45] });
                    if (signatureName) {
                        doc.fontSize(9).fillColor('#555555').text(signatureName, signatureX, signatureY + 60);
                    }
                } catch (signatureError) {
                    console.warn('Skipping invalid signature image:', signatureError.message);
                }
            }

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = {
    generateInvoicePDF
};