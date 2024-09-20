import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from "dotenv";
import { Test, StudentDetails } from './model.js';
import { PDFDocument } from 'pdf-lib'
import fetch from 'node-fetch';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const mongoURL = process.env.MONGO_DB_URL;

app.use(express.json({ limit: '50mb' }));
app.use(cors());

mongoose.connect(mongoURL, {
    serverSelectionTimeoutMS: 50000,
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Database connection established');
}).catch(error => {
    console.error('Database connection error:', error);
});

app.get('/', (req, res) => res.type('html').send(`<p>Server connection for the custom function</p>`));

app.post('/saveStudentDetails', async (req, res) => {
    const { first_name, last_name, score } = req.body;

    if (!first_name || !last_name || score == null) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const studentDetails = new StudentDetails({
            first_name: first_name.toLowerCase(),
            last_name: last_name.toLowerCase(),
            score: Number(score)
        });
        await studentDetails.save();

        res.status(200).json({ 
            message: `Student Details saved: ${first_name} ${last_name} with a score of ${score}`, 
            status: 'OK' 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/getStudentDetails', async (req, res) => {
    const { studentName } = req.body;

    if (!studentName) {
        return res.status(400).json({ error: "Student name is required" });
    }

    try {
        const student = await StudentDetails.findOne({ first_name: studentName.toLowerCase() });
        if (student) {
            res.status(200).json({ student: student, message: `${student.first_name} found` });
        } else {
            res.status(404).json({ message: 'Student not found' });
        } 
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/generatePDF', async (req, res) => {
    const { destinations } = req.body;

    if (!destinations || !Array.isArray(destinations)) {
        return res.status(400).json({ error: "Invalid destinations data" });
    }

    try {
        const doc = new PDFDocument();
        res.contentType('application/pdf');

        doc.pipe(res);

        // Title page
        doc.fontSize(22).text('Bucket List Adventure', { align: 'center' });
        doc.fontSize(14).text('Here are some of your favorite places added to your bucket list!', { align: 'center' });

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const imageWidth = pageWidth / 2;
        const imageHeight = pageHeight / 2;

        // Create an array of promises for image processing
        const imagePromises = destinations.map(async ({ img }, index) => {
            console.log(img);
            try {
                const response = await fetch(img.src);
                const buffer = await response.arrayBuffer();
                
                // Add a new page for each image
                if (index > 0) doc.addPage();

                // Calculate position to center the image
                const x = (pageWidth - imageWidth) / 2;
                const y = (pageHeight - imageHeight) / 2;

                // Add image to the document
                doc.image(buffer, x, y, { 
                    width: imageWidth, 
                    height: imageHeight, 
                    align: 'center', 
                    valign: 'center' 
                });

                // Add image caption or destination name if available
                if (img.alt) {
                    doc.fontSize(14).text(img.alt, 0, y + imageHeight + 20, { align: 'center' });
                }

            } catch (imgError) {
                console.error('Error processing image:', imgError);
                // You might want to add a placeholder image or text here
            }
        });

        // Wait for all images to be processed
        await Promise.all(imagePromises);

        // End the document after all images have been processed
        doc.end();
    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});


// app.post('/combine-pdfs', async (req, res) => {
//     try {
//         const { imageSources } = req.body;
//         const pdfUrls = [
//             'https://rebelrooster.io/vg/nurnberg/pdf/Nuremberg_v1__01.pdf',
//             'https://rebelrooster.io/vg/nurnberg/pdf/Nuremberg_v1__02.pdf',
//             'https://rebelrooster.io/vg/nurnberg/pdf/Nuremberg_v1__03.pdf'
//         ]

//         if (!Array.isArray(imageSources)) {
//             return res.status(400).send('Invalid input: imageSources should be an array of length 4');
//         }

//         // Create a new PDF document
//         const doc = new PDFDocument();

//         // Set up the response
//         res.setHeader('Content-Type', 'application/pdf');
//         res.setHeader('Content-Disposition', 'attachment; filename=combined_nuremberg.pdf');

//         // Pipe the PDF document to the response
//         doc.pipe(res);

//         // Combine PDFs conditionally
//         for (let i = 0; i < pdfUrls.length; i++) {
//             if (imageSources[i]) {
//                 try {
//                     // Fetch the PDF from the URL
//                     const pdfResponse = await fetch(pdfUrls[i]);
//                     if (!pdfResponse.ok) {
//                         throw new Error(`Failed to fetch PDF from ${pdfUrls[i]}`);
//                     }
//                     const pdfBuffer = await pdfResponse.buffer();

//                     // Add the PDF page to the document
//                     doc.addPage().image(pdfBuffer, 0, 0, {fit: [doc.page.width, doc.page.height]});

//                     // If it's not the last page and there's another image source coming up, add a new page
//                     if (i < pdfUrls.length - 1 && imageSources[i + 1]) {
//                         doc.addPage();
//                     }
//                 } catch (error) {
//                     console.error(`Error processing PDF at ${pdfUrls[i]}:`, error);
//                     // Optionally, you can add a blank page or an error message here
//                 }
//             }
//         }

//         // Finalize the PDF
//         doc.end();

//     } catch (error) {
//         console.error('Error combining PDFs:', error);
//         res.status(500).send('Error combining PDFs');
//     }
// });


app.post('/combine-pdfs', async (req, res) => {
    try {
        const { checkboxStates } = req.body; // This should be an array of 0s and 1s from the checkboxes

        console.log(checkboxStates);

        const pdfUrls = [
            'https://rebelrooster.io/vg/nurnberg/pdf/Nuremberg_v1__01.pdf',
            'https://rebelrooster.io/vg/nurnberg/pdf/Nuremberg_v1__02.pdf',
            'https://rebelrooster.io/vg/nurnberg/pdf/Nuremberg_v1__03.pdf',
            'https://rebelrooster.io/vg/nurnberg/pdf/Nuremberg_v1__04.pdf',
            'https://rebelrooster.io/vg/nurnberg/pdf/Nuremberg_v1__05.pdf',
            'https://rebelrooster.io/vg/nurnberg/pdf/Nuremberg_v1__06.pdf',
            'https://rebelrooster.io/vg/nurnberg/pdf/Nuremberg_v1__07.pdf',
            'https://rebelrooster.io/vg/nurnberg/pdf/Nuremberg_v1__08.pdf'
        ];

        // Validation: Ensure the checkbox states match the number of PDFs
        if (!Array.isArray(checkboxStates) || checkboxStates.length !== pdfUrls.length) {
            return res.status(400).send(`Invalid input: checkboxStates should be an array of length ${pdfUrls.length}`);
        }

        // Create a new PDF document
        const mergedPdf = await PDFDocument.create();

        // Fetch and merge only the PDFs corresponding to checked checkboxes
        for (let i = 0; i < pdfUrls.length; i++) {
            if (checkboxStates[i] === 1) { // Only process if the corresponding checkbox is checked
                try {
                    const pdfResponse = await fetch(pdfUrls[i]);
                    if (!pdfResponse.ok) {
                        throw new Error(`Failed to fetch PDF from ${pdfUrls[i]}`);
                    }
                    const pdfBuffer = await pdfResponse.arrayBuffer();

                    const pdfToMerge = await PDFDocument.load(pdfBuffer);
                    const pages = await mergedPdf.copyPages(pdfToMerge, pdfToMerge.getPageIndices());

                    // Add the pages to the merged PDF
                    pages.forEach(page => mergedPdf.addPage(page));
                } catch (error) {
                    console.error(`Error processing PDF at ${pdfUrls[i]}:`, error);
                }
            }
        }

        // Finalize and send the merged PDF
        const pdfBytes = await mergedPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=combined.pdf');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('Error combining PDFs:', error);
        res.status(500).send('Error combining PDFs');
    }
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));