require("dotenv").config();

const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Configure static file serving
app.use(express.static("public"));
// Set the view engine to ejs
app.set("view engine", "ejs");
// In-memory storage for job data

const upload = multer({ dest: "uploads/" });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Ensure this directory exists
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now());
  },
});

// const uploadMiddleware = upload.single("pdbFile", fileFilter);
// const uploadMiddleware = multer({ storage: storage }).single('pdbFile');
const uploadMiddleware = multer({ dest: 'uploads/' }).single('pdbFile');

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "pop3", // CHECK POP3 IMAP FAMNIT SETTINGS
  // ASK IT SRVICE; webmail.famnit.upr.si

  // creds for configuration - CHECK POP3 IMAP FAMNIT SETTINGS
  auth: {
    user: process.env.EMAIL_USER, // Promeni tamo podatke!!!
    pass: process.env.EMAIL_PASS,
  },
});


// IZBRISI POSLE
// Dummy jobs data for demonstration
let jobs = {
  1: {
    jobId: 1,
    jobName: "Job 1",
    status: "RUNNING",
    startTime: "2021-01-01T10:00:00",
    endTime: null,
  },
  2: {
    jobId: 2,
    jobName: "Job 2",
    status: "FINISHED",
    startTime: "2021-01-01T11:00:00",
    endTime: "2021-01-01T11:30:00",
  },
};



// mailchimp !!!
// post req

// firebase
// Set up the multer middleware for file uploads
const fileFilter = (req, file, cb) => {
  // Accept only .pdb files
  if (path.extname(file.originalname).toLowerCase() === ".pdb") {
    cb(null, true);
  } else {
    cb(new Error("Only .pdb files are allowed!"), false);
  }
};

const uploadVerifyMiddleware = (req, res, next) => {
  uploadMiddleware(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading.
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          error: 'File upload error, Please upload a single file'
        })
      }
  
    } else if (err) {
      // An unknown error occurred when uploading.
      return res.status(500).json({
        success: false,
        error: 'File upload error, Please check the form parameters and try again.'
      })
    }
  
    // Everything went fine.
    // res.send('File uploaded successfully');
    // next()
    // console.log("came here s", jobName, email, pdbFile);
    // return res.status(200).json({
    //   success: true,
    //   message: 'File uploaded successfully',
    //   file: path.join(__dirname, '/uploads', pdbFile.filename)
    // })
    next()
  })
}

app.post('/upload2', uploadVerifyMiddleware,(req, res) => {
  
  const { jobName, email } = req.body;
  const pdbFile = req.file;
  console.log('came here', jobName, email, pdbFile);
  
  return res.send('File uploaded successfully');

})

// POST route for file upload
app.post("/upload", uploadMiddleware, (req, res) => {
  const { jobName, email } = req.body;
  const pdbFile = req.file;

  console.log("came here s", jobName, email);

  if (!pdbFile) {
    return res.status(400).send("No PDB file uploaded.");
  }

  const jobId = Date.now(); // Use a timestamp as a simple job ID
  const startTime = new Date();

  const newFilePath = path.join(__dirname, "uploads", pdbFile.filename);
  const outputFilePath = path.join(__dirname, "uploads", `${jobId}_result.txt`);
    // Store job data
    jobs[jobId] = {
      jobName: jobName || `Job-${jobId}`,
      email,
      status: "RUNNING",
      startTime,
      endTime: null,
      filePath: newFilePath,
    };
  // Define the output file path
  // const outputFilePath = path.join(__dirname, "uploads", `${jobId}_result.txt`);

  // Execute the R script with the uploaded file path and the output file path as arguments
  exec(
    `Rscript add_symm_residues.r ${pdbFile.path} ${outputFilePath}`,
    (error, stdout, stderr) => {
      if (error) {
        console.error("Error executing R script:", error);
        jobs[jobId].status = "ERROR";
        res.status(500).send("Error processing PDB file.");
        return;
      }

      // Once the script has completed, read the output file
      fs.readFile(outputFilePath, "utf8", (readError, data) => {
        if (readError) {
          console.error("Error reading output file:", readError);
          jobs[jobId].status = "ERROR";
          res.status(500).send("Error reading result file.");
          return;
        }

        // Update the job status
        jobs[jobId].status = "FINISHED";
        jobs[jobId].endTime = new Date();

        // link - results stored locally
        // email with the link!!!
        // store in db or gen link (hash)
        // crontab in linux --- later
        // Send an email with the results as an attachment
        const mailOptions = {
          from: "your-email@gmail.com",
          to: email,
          subject: `Job ${jobs[jobId].jobName} Completed`,
          text: "Your PDB file has been processed. Please find the results attached.",
          attachments: [
            {
              filename: `${jobId}_result.txt`,
              content: data,
            },
          ],
        };

        transporter.sendMail(mailOptions, (mailError, info) => {
          if (mailError) {
            console.error("Error sending email:", mailError);
          } else {
            console.log("Result email sent:", info.response);
          }
        });

        // Optionally, clean up by deleting the uploaded and result files
        // fs.unlinkSync(pdbFile.path);
        // fs.unlinkSync(outputFilePath);
      });
    }
  );

  res.send(`Job ${jobs[jobId].jobName} is now running.`);
});

// GET route for the queue page
app.get("/queue", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "queue.html"));
});

// Start the server
const PORT = 3000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);

app.get("/api/jobs", (req, res) => {
  res.json(Object.values(jobs));
});
