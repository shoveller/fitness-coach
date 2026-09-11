import {useAgent} from "agents/react";
import {useAgentChat} from "agents/chat/react";
import type {SubmitEventHandler} from "react";

function App() {
  const agent = useAgent({ agent: 'ThinkAgent' })
  const { messages, sendMessage } = useAgentChat({ agent })
  const onSubmit: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const text = formData.get('input') as string
    if (!text?.trim()) {
      return
    }
    await sendMessage({ text })
    e.currentTarget.reset()
  }

  return (
    <>
      <form onSubmit={onSubmit}>
        <input name="input" />
        <button type="submit">보내기</button>
      </form>
      <div>{JSON.stringify(messages)}</div>
    </>
  )
}

export default App
