import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

// 실제 createLLM 프록시 / R2를 사용하는 통합 검사. 개발 서버를 먼저 실행한다.
const base = process.env.COACH_URL ?? 'http://127.0.0.1:5173'

const name = `smoke-${randomUUID()}`

const url = `${base.replace(/^http/, 'ws')}/agents/coach-agent/${name}`

let messages = []

async function connect() {
  const socket = new WebSocket(url)
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data)

    if (data.type === 'cf_agent_stream_resuming') {
      socket.send(JSON.stringify({ type: 'cf_agent_stream_resume_ack', id: data.id }))
    }
  })
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  return socket
}

function turn(socket, text) {
  const id = randomUUID()
  messages.push({ id: randomUUID(), role: 'user', parts: [{ type: 'text', text }] })

  return new Promise((resolve, reject) => {
    const chunks = []
    const timer = setTimeout(() => finish(new Error('응답 제한 시간 180초 초과')), 180_000)

    const finish = (error) => {
      clearTimeout(timer)
      socket.removeEventListener('message', receive)
      socket.removeEventListener('close', closed)

      if (error) reject(error)
      else resolve(chunks)
    }

    const closed = () => finish(new Error('응답 중 연결 종료'))

    const receive = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'cf_agent_chat_messages' && data.messages) messages = data.messages

      if (data.type !== 'cf_agent_use_chat_response' || data.id !== id) return

      if (data.error) return finish(new Error(data.body))

      if (data.body?.trim()) {
        const chunk = JSON.parse(data.body)
        chunks.push(chunk)

        if (chunk.type === 'error') return finish(new Error(chunk.errorText))

        if (chunk.type === 'tool-input-available' || chunk.type === 'tool-output-available') {
          console.log(JSON.stringify(chunk))
        }
      }

      if (data.done) {
        console.log(textOf(chunks))
        finish()
      }
    }

    socket.addEventListener('message', receive)
    socket.addEventListener('close', closed)
    socket.send(JSON.stringify({
      type: 'cf_agent_use_chat_request', id,
      init: { method: 'POST', body: JSON.stringify({ messages, trigger: 'submit-message' }) }
    }))
  })
}

const calls = chunks => chunks.filter(chunk => chunk.type === 'tool-input-available')

const textOf = chunks => chunks.flatMap(chunk => chunk.type === 'text-delta' ? [chunk.delta] : []).join('')

let socket = await connect()

console.log(`검증용 에이전트: ${name}`)

try {
  const log = await turn(socket, '오늘 스쿼트 했어. 80kg으로 5회씩 5세트 했어')
  assert(calls(log).some(call => /logs\/\d{4}-\d{2}-\d{2}\.md/.test(JSON.stringify(call.input))), '날짜별 로그 도구 호출')
  assert(calls(log).some(call => JSON.stringify(call.input).includes('plan.md')), '주간 계획 도구 호출')
  const week = await turn(socket, '이번 주에 무엇을 했지? 저장한 로그를 읽어 알려줘')
  assert(calls(week).some(call => /read/.test(call.toolName)), '저장된 파일 읽기')
  assert.match(textOf(week), /80/)
  const memory = await turn(socket, '저는 75kg이고 왼쪽 무릎이 안 좋아요. 5km를 30분 안에 뛰고 싶어요')
  assert(calls(memory).some(call => call.toolName === 'set_context' && JSON.stringify(call.input).includes('memory')), '영속 메모리 저장')

  // 쿠키/클라이언트 대화 이력 없이 같은 DO에 새 연결을 만든다.
  await new Promise(resolve => {
    socket.addEventListener('close', resolve, { once: true })
    socket.close()
  })
  messages = []
  socket = await connect()
  const recalled = await turn(socket, '내 몸 상태와 목표를 고려해서 내일 운동 계획을 알려줘. 기억하는 체중, 부상, 목표도 적어줘')
  assert.match(textOf(recalled), /75/)
  assert.match(textOf(recalled), /왼쪽.*무릎|좌측.*무릎/s)
  assert.match(textOf(recalled), /5\s*km|5킬로/i)
  assert.match(textOf(recalled), /30분|30\s*분/)
  const skill = await turn(socket, '스쿼트 자세를 알려줘. 가이드를 사용하고 사용 후 언로드해줘')
  assert(calls(skill).some(call => call.toolName === 'load_context' && JSON.stringify(call.input).includes('squat-form.md')), 'R2 스쿼트 가이드 로드')
  assert(calls(skill).some(call => call.toolName === 'unload_context'), '가이드 언로드')
  const extension = await turn(socket, '1회 최대 중량(1RM) 계산기를 만들어줘')
  assert(calls(extension).some(call => call.toolName === 'load_extension'), '런타임 확장 생성')
  const result = await turn(socket, '80kg으로 5회 들면 내 1RM이 얼마야?')
  assert(calls(result).some(call => call.toolName.startsWith('one_rm_')), '다음 대화에서 생성한 확장 호출')
  assert.match(textOf(result), /93/)
  console.log('PASS: 로그, 주간 조회, 새 연결의 메모리, R2 로드/언로드, 런타임 1RM 도구')
} finally {
  socket.close()
}
