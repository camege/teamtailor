const requestPromise = require('request-promise-native');
const createCSV = require('csv-writer').createObjectCsvWriter;
const express = require('express')
const app = express()
const port = 3000
var path = require('path');
const { text } = require('body-parser');

const csv = createCSV({
    path: "./files/teamtailor_test.csv",
    header: [
      {id: "candidate_id", title: "ID"},
      {id: "first_name", title: "First Name"},
      {id: "last_name", title: "Last Name"},
      {id: "email", title: "E-Mail"},
      {id: "job_application_id", title: "Job Application ID"},
      {id: "job_application_created_at", title: "Job Application Created At"}

    ]
  });

async function makeAPICall(url, chunk) {
    return requestPromise({
      url: url,
      method: 'GET',
      headers: {
        'Authorization': 'Token token=UN2d6SNd0RoesuGxxAKFVin9UPnNHEAmfhejdZa5',
        'X-Api-Version': '20210218',
        'include': 'job-applications'
      }
    });
};

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
};

async function processUsers(){
    console.time('test')
    var page_counter = 1;
    var last_page = 2;
    var job_app_urls = [];
    var promises = [];
    while(page_counter < last_page){
      let temp = await makeAPICall('https://api.teamtailor.com/v1/candidates?page[number]='+ page_counter.toString() +'&page[size]=30');
      // console.log(temp);
      var candidates = JSON.parse(temp)['data'];
      for(var candidate in candidates){
              // console.log(candidates[candidate]['id'], candidates[candidate]['attributes']['first-name'], candidates[candidate]['attributes']['last-name'], candidates[candidate]['attributes']['email']);
            var a = (candidates[candidate]['relationships']['job-applications']['links']['related']);
            job_app_urls.push({ candidate_id: candidates[candidate]['id'], first_name: candidates[candidate]['attributes']['first-name'], last_name: candidates[candidate]['attributes']['last-name'], email: candidates[candidate]['attributes']['email'], job_app_url:a });
            promises.push(a);
            
      }      
      last_page = parseInt(JSON.parse(temp)['meta']['page-count'])+1;
      page_counter++;
      
    }
    const chunkSize = 45;
    results = []
    for (let i = 0; i < promises.length; i += chunkSize) {
        const chunk = promises.slice(i, i + chunkSize);
        // console.log(chunk.length);
        const getUsers = async () =>{
            // Return an array of Promises
                const promisesArray = chunk.map( async userId =>{
                    const userNamesRes =  await makeAPICall(userId)
                    return userNamesRes
            })
            //    console.log(promisesArray)
            // Resolve the Promises
                const userInfo = await Promise.all(promisesArray)
                    
                userInfo.map(promiseRecord=>{
                    // console.log(JSON.parse(promiseRecord)['data'][0]['id'], JSON.parse(promiseRecord)['data'][0]['attributes']['created-at'])
                })
                return userInfo;
                
        };
        const userInfo = await getUsers()
        results.push(userInfo);
        // console.log(i, promises.length);
        if (promises.length - i < chunkSize){
            continue;
        }
        else{
            await sleep(10000);
        }        
        
    }

    // console.log(results);
    var merged = [].concat.apply([], results);
    for(var b in merged){
        job_app_urls[b]['job_application_id'] = JSON.parse(merged[b])['data'][0]['id'];
        job_app_urls[b]['job_application_created_at'] = JSON.parse(merged[b])['data'][0]['attributes']['created-at'];
        // await console.log(job_app_urls[b]);
        await csv.writeRecords([
            { candidate_id: job_app_urls[b]['candidate_id'], first_name: job_app_urls[b]['first_name'], last_name: job_app_urls[b]['last_name'], email: job_app_urls[b]['email'], job_application_id: job_app_urls[b]['job_application_id'], job_application_created_at:  job_app_urls[b]['job_application_created_at'] }
        ])

    };
    console.timeEnd('test')
    // console.log(job_app_urls);
    
  };


var FILES_DIR = path.join(__dirname, 'files')


app.get('/', function(req, res){
    res.send('<ul>' +
      '<li>Download <a href="/files/teamtailor_test.csv">notes/groceries.txt</a>.</li>' +
      '</ul>')
  });

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

app.get('/files/:file(*)', function(req, res, next){
   
    processUsers().then(()=>{
        res.download(req.params.file, { root: FILES_DIR }, function (err) {
            //   await processUsers();
              if (!err) return; // file sent
              if (err.status !== 404) return next(err); // non-404 error
              // file for download not found
              res.statusCode = 404;
              res.send('Cant find that file, sorry!');
            });
    });
  });







  
