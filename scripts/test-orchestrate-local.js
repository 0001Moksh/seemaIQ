const greetText = (role, resumeName) => {
  const namestr = resumeName ? resumeName.split(' ')[0] : 'there'
  if (role === 'hr') return `Hello ${namestr}, I’m Mira Sharma from HR. In this round, we’ll focus on communication and workplace behaviour. Let’s begin.`
  if (role === 'technical') return `Hi ${namestr}, I’m Ashish Yadev, Domain Expert. I’ll evaluate your technical approach. Ready?`
  return `Good to meet you ${namestr}, I’m Ryan Bhardwaj, Hiring Manager. This round focuses on leadership and ownership.`
}

function mockGenerateQuestion(role, experience, round, previousQuestions) {
  return `Mock question for ${role} round ${round}: Describe a challenging problem you solved.`
}

function mockEvaluate(question, answer) {
  return { clarity: 80, relevance: 75, completeness: 70, confidence: 85, feedback: 'Nice answer; provide more structure and examples.' }
}

async function handle(body) {
  const action = body.action || 'greet'
  const role = body.role || 'hr'
  if (action === 'greet') {
    const text = greetText(role, body.resumeData?.name)
    const meta = { improvement_is: '', candidate_score: 0, interview_complete: false, question_complete: `0/${body.questionsPerRound || 5}`, role, status: 'greet' }
    return { text, meta }
  }
  if (action === 'question') {
    const q = mockGenerateQuestion(role, body.resumeData?.experience || 'mid', body.round || 1, body.previousQuestions || [])
    const meta = { improvement_is: '', candidate_score: 0, interview_complete: false, question_complete: `${(body.questionNum||1)-1}/${body.questionsPerRound || 5}`, role, status: 'question' }
    return { text: q, meta }
  }
  if (action === 'evaluate') {
    const evalRes = mockEvaluate(body.question, body.answer)
    const improvement_is = evalRes.feedback
    const candidate_score = Math.round((evalRes.clarity + evalRes.relevance + evalRes.completeness + evalRes.confidence) / 4)
    const completedCount = Number(body.completedCount || 0) + 1
    const questionsPerRound = Number(body.questionsPerRound || 5)
    const finished = completedCount >= questionsPerRound
    const meta = { improvement_is, candidate_score, interview_complete: finished, question_complete: `${completedCount}/${questionsPerRound}`, role, status: 'conversation' }
    return { text: improvement_is, meta, evaluation: evalRes }
  }
  throw new Error('Unknown action')
}

(async () => {
  console.log('GREET')
  console.log(JSON.stringify(await handle({ action: 'greet', role: 'hr', resumeData: { name: 'Test Candidate' } }), null, 2))
  console.log('\nQUESTION')
  console.log(JSON.stringify(await handle({ action: 'question', role: 'technical', round: 1, questionNum: 1 }), null, 2))
  console.log('\nEVALUATE')
  console.log(JSON.stringify(await handle({ action: 'evaluate', role: 'hr', question: 'Tell me about a project', answer: 'I built X', completedCount: 1, questionsPerRound: 3 }), null, 2))
})().catch(e => { console.error(e); process.exit(1) })
