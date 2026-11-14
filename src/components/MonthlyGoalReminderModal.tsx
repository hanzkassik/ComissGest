import { ArrowRight, Target, X } from 'lucide-react'

interface MonthlyGoalReminderModalProps {
  message: string
  onDismiss: () => void
  onCreateGoal: () => void
}

export function MonthlyGoalReminderModal({ message, onDismiss, onCreateGoal }: MonthlyGoalReminderModalProps) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onDismiss() }}>
    <section className="company-modal monthly-goal-reminder-modal" role="dialog" aria-modal="true" aria-labelledby="monthly-goal-reminder-title">
      <div className="company-modal-heading"><span className="create-icon"><Target size={19} /></span><button className="modal-close-button" type="button" aria-label="Fechar aviso" onClick={onDismiss}><X size={18} /></button></div>
      <h2 id="monthly-goal-reminder-title">Vamos definir sua meta deste mês?</h2>
      <p className="monthly-goal-reminder-message">{message}</p>
      <div className="monthly-goal-reminder-actions"><button className="quiet-button" type="button" onClick={onDismiss}>Agora não</button><button className="primary-button" type="button" onClick={onCreateGoal}>Cadastrar meta <ArrowRight size={16} /></button></div>
    </section>
  </div>
}
