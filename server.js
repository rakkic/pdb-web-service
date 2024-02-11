require('dotenv').config();

const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Generate a unique filename but keep the original extension
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const fileFilter = (req, file, cb) => {
    // Accept only .pdb files
    if (path.extname(file.originalname).toLowerCase() === '.pdb') {
        cb(null, true);
    } else {
        cb(new Error('Only .pdb files are allowed!'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

app.use(express.static('public'));
// Set the view engine to ejs
app.set('view engine', 'ejs');

let jobs = {
    1: {
        jobId: 1,
        jobName: 'Job 1',
        status: 'RUNNING',
        startTime: '2021-01-01T10:00:00',
        endTime: null,
    },
    2: {
        jobId: 2,
        jobName: 'Job 2',
        status: 'FINISHED',
        startTime: '2021-01-01T11:00:00',
        endTime: '2021-01-01T11:30:00',
    },
};

app.use(express.static('public'));

const transporter = nodemailer.createTransport({
    service: 'pop3',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});


app.post('/upload', upload.single('pdbFile'), (req, res) => {
    const { jobName, email } = req.body;
    const pdbFile = req.file;

    if (!pdbFile) {
        return res.status(400).send('No PDB file uploaded.');
    }

    const jobId = Date.now();
    const startTime = new Date();

    jobs[jobId] = {
        jobId: jobId,
        jobName: jobName || `Job-${jobId}`,
        email: email,
        status: 'RUNNING',
        startTime: startTime,
        endTime: null,
    };

    const pdbFilePath = path.join(__dirname, '/uploads', pdbFile.filename);
    const outputFilePath = path.join(__dirname, '/uploads', `${jobId}_result.pdb`);

    //const tempRScriptPath = path.join(__dirname, '/uploads', `tempScript_${Date.now()}.R`);

    const rScriptPath = path.join(__dirname, 'testScript.r');

    const command = `Rscript --vanilla "${rScriptPath}" "${pdbFilePath}" "${outputFilePath}"`;


    exec(command, (error, stdout, stderr) => {
      if (error) {
          console.error(`Error: ${error.message}`);
          return;
      }
      if (stderr) {
          console.error(`Stderr: ${stderr}`);
          return;
      }
      console.log(`R script executed successfully. Output: ${stdout}`);
        // Handle post-execution logic here, such as sending a response to the client

      //   if (readError) {
      //     console.error('Error reading output file:', readError);
      //     jobs[jobId].status = 'ERROR';
      //     return res.status(500).send('Error reading result file.');
      //   }

      //   // Update the job status
      //   jobs[jobId].status = 'FINISHED';
      //   jobs[jobId].endTime = new Date();

      //   // Send an email with the results as an attachment
      //   const mailOptions = {
      //     from: process.env.EMAIL_USER,
      //     to: email,
      //     subject: `Job ${jobName || `Job-${jobId}`} Completed`,
      //     text: 'Your PDB file has been processed. Please find the results attached.',
      //     attachments: [
      //       {
      //         filename: `${jobId}_result.pdb`,
      //         content: data,
      //       },
      //     ],
      //   };

      //   transporter.sendMail(mailOptions, (mailError, info) => {
      //     if (mailError) {
      //       console.error('Error sending email:', mailError);
      //       jobs[jobId].status = 'ERROR';
      //     } else {
      //       console.log('Result email sent:', info.response);
      //       jobs[jobId].status = 'EMAIL_SENT';
      //       // Clean up the uploaded and result files after sending the email
      //       fs.unlink(pdbFile.path, (unlinkError) => {
      //         if (unlinkError)
      //           console.error('Error deleting uploaded file:', unlinkError);
      //         else console.log('Uploaded file deleted successfully.');
      //       });
      //       fs.unlink(outputFilePath, (unlinkError) => {
      //         if (unlinkError)
      //           console.error('Error deleting result file:', unlinkError);
      //         else console.log('Result file deleted successfully.');
      //       });
      //     }

      //     // Regardless of email success, send a response back to the user
      //     res.json({
      //       message: `Job ${jobName || `Job-${jobId}`} completed. Email ${
      //         mailError ? 'not ' : ''
      //       }sent.`,
      //       jobId: jobId,
      //       status: jobs[jobId].status,
      //     });
      //   });
    });
});


app.get('/queue', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'queue.html'));
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

app.get('/api/jobs', (req, res) => {
    res.json(Object.values(jobs));
});
