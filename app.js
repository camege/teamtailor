const createCSV = require("csv-writer").createObjectCsvWriter;
const express = require("express");
const app = express();
const port = 3000;
var path = require("path");
const { text } = require("body-parser");
const fetch = require("node-fetch");

const csv = createCSV({
  path: "./files/teamtailor_test.csv",
  header: [
    { id: "candidate_id", title: "ID" },
    { id: "first_name", title: "First Name" },
    { id: "last_name", title: "Last Name" },
    { id: "email", title: "E-Mail" },
    { id: "job_application_id", title: "Job Application ID" },
    { id: "job_application_created_at", title: "Job Application Created At" },
  ],
});

async function make_api_call(url, chunk) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: "Token token=" + process.env.APITOKEN,
        "X-Api-Version": "20210218",
        include: "job-applications",
      },
    });
    const data = await res.json();
    return data;
  } catch (error) {
    console.error(error);
  }
}

module.exports = { make_api_call };

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function process_users() {
  console.time("test");
  let page_counter = 1;
  let last_page = 2;
  let job_app_urls = [];
  let promises = [];
  while (page_counter < last_page) {
    let temp = await make_api_call(
      "https://api.teamtailor.com/v1/candidates?page[number]=" +
        page_counter.toString() +
        "&page[size]=30"
    );
    //   console.log(temp);
    let candidates = temp["data"];
    for (var candidate in candidates) {
      // console.log(candidates[candidate]['id'], candidates[candidate]['attributes']['first-name'], candidates[candidate]['attributes']['last-name'], candidates[candidate]['attributes']['email']);
      const job_desc_url =
        candidates[candidate]["relationships"]["job-applications"]["links"][
          "related"
        ];
      job_app_urls.push({
        candidate_id: candidates[candidate]["id"],
        first_name: candidates[candidate]["attributes"]["first-name"],
        last_name: candidates[candidate]["attributes"]["last-name"],
        email: candidates[candidate]["attributes"]["email"],
        job_app_url: job_desc_url,
      });
      promises.push(job_desc_url);
    }
    last_page = parseInt(temp["meta"]["page-count"]) + 1;
    page_counter++;
  }
  const chunk_size = 45;
  const results = [];
  for (let i = 0; i < promises.length; i += chunk_size) {
    const chunk = promises.slice(i, i + chunk_size);
    // console.log(chunk.length);
    const get_users = async () => {
      // Return an array of Promises
      const promises_array = chunk.map(async (userId) => {
        const usernames_res = await make_api_call(userId);
        return usernames_res;
      });
      //    console.log(promises_array)
      // Resolve the Promises
      const user_info = await Promise.all(promises_array);

      user_info.map((promiseRecord) => {
        // console.log(JSON.parse(promiseRecord)['data'][0]['id'], JSON.parse(promiseRecord)['data'][0]['attributes']['created-at'])
      });
      return user_info;
    };
    const user_info = await get_users();
    results.push(user_info);
    // console.log(i, promises.length);
    if (promises.length - i < chunk_size) {
      continue;
    } else {
      await sleep(10000);
    }
  }

  // console.log(results);
  let merged = [].concat.apply([], results);
  for (var b in merged) {
    job_app_urls[b]["job_application_id"] = merged[b]["data"][0]["id"];
    // console.log((merged[b]["data"][0]["attributes"]["created-at"]).replace("T", " ").substr(0,16));
    job_app_urls[b]["job_application_created_at"] =
    (merged[b]["data"][0]["attributes"]["created-at"]).replace("T", " ").substr(0,16);
    // await console.log(job_app_urls[b]);
    // console.log(typeof(job_app_urls[b]["job_application_created_at"]));
    await csv.writeRecords([
      {
        candidate_id: job_app_urls[b]["candidate_id"],
        first_name: job_app_urls[b]["first_name"],
        last_name: job_app_urls[b]["last_name"],
        email: job_app_urls[b]["email"],
        job_application_id: job_app_urls[b]["job_application_id"],
        job_application_created_at:
          job_app_urls[b]["job_application_created_at"],
      },
    ]);
  }
  console.timeEnd("test");
  // console.log(job_app_urls);
}

var FILES_DIR = path.join(__dirname, "files");

app.get("/", function (req, res) {
  res.send(
    "<ul>" +
      '<li>Download <a href="/files/teamtailor_test.csv">teamtailor_test.csv</a>.</li>' +
      "</ul>"
  );
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

app.get("/files/:file(*)", function (req, res, next) {
  process_users().then(() => {
    res.download(req.params.file, { root: FILES_DIR }, function (err) {
      //   await process_users();
      if (!err) return; // file sent
      if (err.status !== 404) return next(err); // non-404 error
      // file for download not found
      res.statusCode = 404;
      res.send("Cant find that file, sorry!");
    });
  });
});
