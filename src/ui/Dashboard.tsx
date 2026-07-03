import { useEffect } from 'react'
import TopBar from './components/TopBar'
import ChartPanel from './components/ChartPanel'
import BiasGauge from './components/BiasGauge'
import ScoreBreakdown from './components/ScoreBreakdown'
import Commentary from './components/Commentary'
import DominancePanel from './components/DominancePanel'
import SessionControls from './components/SessionControls'
import LabelOutcomeModal from './components/LabelOutcomeModal'
import { startMarket, stopMarket } from '../state/controller'

export default function Dashboard() {
  useEffect(() => {
    void startMarket()
    return () => stopMarket()
  }, [])

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <div className="flex-1 min-h-0 grid grid-cols-[1fr_340px] gap-3 p-3">
        <div className="min-h-0 rounded-lg border border-neutral-800 overflow-hidden">
          <ChartPanel />
        </div>
        <div className="min-h-0 flex flex-col gap-3 overflow-y-auto">
          <BiasGauge />
          <ScoreBreakdown />
          <DominancePanel />
          <div className="flex-1 min-h-40">
            <Commentary />
          </div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <SessionControls />
      </div>
      <LabelOutcomeModal />
    </div>
  )
}
