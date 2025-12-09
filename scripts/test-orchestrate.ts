import { handleOrchestrate } from "../app/api/interview/orchestrate/route"

async function run() {
  console.log('GREET test')
  const greet = await handleOrchestrate({ action: 'greet', role: 'hr', resumeData: { name: 'Test Candidate' } })
  console.log(JSON.stringify(greet, null, 2))

  console.log('\nQUESTION test')
  const question = await handleOrchestrate({ action: 'question', role: 'technical', round: 1, questionNum: 1, resumeData: { experience: 'mid' } })
  console.log(JSON.stringify(question, null, 2))

  console.log('\nEVALUATE test (fallback eval)')
  const evalRes = await handleOrchestrate({ action: 'evaluate', role: 'hr', question: 'Tell me about yourself', answer: 'I am a software engineer with 5 years experience', completedCount: 1, questionsPerRound: 5 })
  console.log(JSON.stringify(evalRes, null, 2))
}

run().catch(e => {
  console.error('Test runner failed:', e)
  process.exit(1)
})
