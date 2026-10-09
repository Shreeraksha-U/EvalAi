
const API_URL = '/api/evaluate';
const EXTRACT_API_URL = '/api/extract';

const files = {
  student: null,
  model: null
};

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) =>
    t.classList.toggle(
      'active',
      (i === 0 && name === 'evaluate') ||
      (i === 1 && name === 'analyze')
    )
  );

  document.querySelectorAll('.panel').forEach(p =>
    p.classList.remove('active')
  );

  document.getElementById('tab-' + name).classList.add('active');
}

function handleFile(input, key) {
  const file = input.files[0];

  if (!file) return;

  files[key] = file;

  document.getElementById(
    'file-' + key + '-name'
  ).textContent = file.name;
}

async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result.split(',')[1]);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

function showError(id, msg) {
  const el = document.getElementById(id);

  el.textContent = msg;
  el.classList.add('show');
}

function hideError(id) {
  document.getElementById(id).classList.remove('show');
}

function colorScore(val, max) {
  const pct = (val / max) * 100;

  return pct >= 75
    ? 'high'
    : pct >= 50
      ? 'mid'
      : 'low';
}


async function callAPI(prompt, fileContent = null, fileType = null) {
  const body = {
    prompt
  };

  if (fileContent && fileType) {
    body.fileContent = fileContent;
    body.fileType = fileType;
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    throw new Error(
      error.error?.message ||
      error.message ||
      'Request failed'
    );
  }

  const data = await response.json();

  return data.result;
}

 // Extract text from an uploaded PDF/image.

async function extractText(file) {
  const base64 = await readFileAsBase64(file);

  const response = await fetch(EXTRACT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileContent: base64,
      fileType: file.type
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    throw new Error(
      error.error?.message ||
      error.message ||
      'Failed to extract text from document'
    );
  }

  const data = await response.json();

  return data.text;
}


async function runEvaluate() {
  hideError('eval-error');

  const subject =
    document.getElementById('eval-subject').value.trim();

  const marks =
    document.getElementById('eval-marks').value.trim();

  const question =
    document.getElementById('eval-question').value.trim();

  const answer =
    document.getElementById('eval-answer').value.trim();

  if (!question || !answer) {
    showError(
      'eval-error',
      'Please enter both the question and your answer.'
    );

    return;
  }

  const totalMarks = parseInt(marks) || 10;

  document.getElementById('eval-form').style.display = 'none';
  document.getElementById('eval-loading').classList.add('show');

  const prompt = `You are an expert university examiner. Evaluate this student answer and return ONLY a JSON object (no markdown, no extra text).

Subject: ${subject || 'General'}
Total Marks: ${totalMarks}
Question: ${question}
Student Answer: ${answer}

Return this exact JSON structure:
{
  "estimated_marks": <number out of ${totalMarks}>,
  "content_score": <0-100>,
  "structure_score": <0-100>,
  "grammar_score": <0-100>,
  "content_note": "<one sentence about content coverage>",
  "structure_note": "<one sentence about structure>",
  "grammar_note": "<one sentence about grammar/language>",
  "detailed_feedback": "<3-4 sentences of comprehensive feedback>",
  "suggestions": "<3-4 specific, actionable suggestions to improve the answer, numbered>"
}`;

  try {
    const result = await callAPI(prompt);

    displayEvalResults(result, totalMarks);

  } catch (error) {
    document.getElementById('eval-form').style.display = 'block';
    document.getElementById('eval-loading').classList.remove('show');

    showError('eval-error', error.message);
  }
}


function displayEvalResults(r, totalMarks) {
  document.getElementById('eval-loading').classList.remove('show');
  document.getElementById('eval-results').classList.add('show');

  const estEl =
    document.getElementById('r-est-marks');

  estEl.textContent =
    `${r.estimated_marks}/${totalMarks}`;

  estEl.className =
    'score-val ' +
    colorScore(r.estimated_marks, totalMarks);


  const setScore = (id, val) => {
    const el = document.getElementById(id);

    el.textContent = val + '%';

    el.className =
      'score-val ' +
      (val >= 75
        ? 'high'
        : val >= 50
          ? 'mid'
          : 'low');
  };


  setScore('r-content', r.content_score);
  setScore('r-structure', r.structure_score);
  setScore('r-grammar', r.grammar_score);


  const metrics = [
    {
      name: 'Content Coverage',
      pct: r.content_score,
      note: r.content_note
    },
    {
      name: 'Answer Structure',
      pct: r.structure_score,
      note: r.structure_note
    },
    {
      name: 'Grammar & Language',
      pct: r.grammar_score,
      note: r.grammar_note
    }
  ];


  document.getElementById('r-metrics').innerHTML =
    metrics.map(m => `
      <div class="metric-bar">
        <div class="metric-top">
          <span class="metric-name">${m.name}</span>
          <span class="metric-pct">${m.pct}%</span>
        </div>

        <div class="bar-track">
          <div
            class="bar-fill"
            style="width:${m.pct}%"
          ></div>
        </div>

        <div class="metric-note">
          ${m.note || ''}
        </div>
      </div>
    `).join('');


  document.getElementById('r-feedback').textContent =
    r.detailed_feedback || '';

  document.getElementById('r-suggestions').textContent =
    r.suggestions || '';
}


function resetEval() {
  document.getElementById('eval-results').classList.remove('show');

  document.getElementById('eval-form').style.display = 'block';
}


async function runAnalyze() {
  hideError('ana-error');

  const subject =
    document.getElementById('ana-subject').value.trim();

  const total =
    document.getElementById('ana-total').value.trim();

  let studentText =
    document.getElementById('ana-student-text').value.trim();

  let modelText =
    document.getElementById('ana-model-text').value.trim();


  const buildPrompt = (st, mt, totalM) => `You are an expert exam evaluator. Compare the student's answer against the model answer. Return ONLY a JSON object.

Subject: ${subject || 'General'}
Total Marks: ${totalM}

STUDENT ANSWER:
${st}

MODEL ANSWER:
${mt}

Return this exact JSON:
{
  "likely_score": "<e.g. 14/20 or range 12-15/20>",
  "coverage_pct": <0-100>,
  "accuracy_pct": <0-100>,
  "extra_points_count": <number of valid extra points student included>,
  "missing_points": ["<point 1>","<point 2>","<point 3 if any>"],
  "good_points": ["<what student did well 1>","<what student did well 2>"],
  "structure_issues": "<2-3 sentences on structure problems if any, or 'Structure is good'>",
  "score_breakdown": "<detailed explanation of how marks were likely allocated and lost>"
}`;


  const totalM = parseInt(total) || 20;


  if (!studentText && !files.student) {
    showError(
      'ana-error',
      'Please provide your answer - upload a file or paste text.'
    );

    return;
  }


  if (!modelText && !files.model) {
    showError(
      'ana-error',
      'Please provide the model answer -  upload a file or paste text.'
    );

    return;
  }


  document.getElementById('ana-form').style.display = 'none';
  document.getElementById('ana-loading').classList.add('show');


  try {
    let result;


    /*
     * If both answers were typed/pasted,
     * send them directly for comparison.
     */
    if (studentText && modelText) {

      result = await callAPI(
        buildPrompt(studentText, modelText, totalM)
      );

    } else {

      /*
       * Extract student answer from uploaded file.
       */
      if (!studentText && files.student) {

        if (files.student.type.includes('text')) {
          studentText = await files.student.text();
        } else {
          studentText = await extractText(files.student);
        }
      }


      /*
       * Extract model answer from uploaded file.
       */
      if (!modelText && files.model) {

        if (files.model.type.includes('text')) {
          modelText = await files.model.text();
        } else {
          modelText = await extractText(files.model);
        }
      }


      /*
       * Compare the extracted answers.
       */
      result = await callAPI(
        buildPrompt(studentText, modelText, totalM)
      );
    }


    displayAnaResults(result);

  } catch (error) {

    document.getElementById('ana-form').style.display = 'block';
    document.getElementById('ana-loading').classList.remove('show');

    showError('ana-error', error.message);
  }
}


function displayAnaResults(r) {
  document.getElementById('ana-loading').classList.remove('show');
  document.getElementById('ana-results').classList.add('show');


  document.getElementById('a-likely').textContent =
    r.likely_score || '—';

  document.getElementById('a-likely').className =
    'score-val';


  const setScore = (id, val) => {
    const el = document.getElementById(id);

    el.textContent = val + '%';

    el.className =
      'score-val ' +
      (val >= 75
        ? 'high'
        : val >= 50
          ? 'mid'
          : 'low');
  };


  setScore('a-coverage', r.coverage_pct);
  setScore('a-accuracy', r.accuracy_pct);


  const extraEl =
    document.getElementById('a-extra');

  extraEl.textContent =
    r.extra_points_count || 0;

  extraEl.className =
    'score-val ' +
    (r.extra_points_count > 0 ? 'high' : '');


  const missing =
    r.missing_points || [];


  document.getElementById('a-missing').innerHTML =
    missing.length
      ? '<div class="tag-list">' +
        missing
          .map(p => `<span class="tag miss">${p}</span>`)
          .join('') +
        '</div>'
      : '<div class="content" style="color:var(--white-faint)">No significant missing points detected.</div>';


  document.getElementById('a-structure').textContent =
    r.structure_issues || '';


  const good =
    r.good_points || [];


  document.getElementById('a-good').innerHTML =
    good.length
      ? '<div class="tag-list">' +
        good
          .map(p => `<span class="tag good">${p}</span>`)
          .join('') +
        '</div>'
      : '<div class="content" style="color:var(--white-faint)">Keep practicing.</div>';


  document.getElementById('a-breakdown').textContent =
    r.score_breakdown || '';
}


function resetAna() {
  document.getElementById('ana-results').classList.remove('show');

  document.getElementById('ana-form').style.display = 'block';

  files.student = null;
  files.model = null;

  document.getElementById(
    'file-student-name'
  ).textContent = '';

  document.getElementById(
    'file-model-name'
  ).textContent = '';
}
