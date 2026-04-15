import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// =============== GAME CARD LIST (Only TicTacToe now) ===============
const GAMES = [
  {
    id: "tictactoe",
    title: "Tic-Tac-Toe",
    desc: "Classic 3×3 duel. You are X, AI is O.",
    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRGHlnocgdW2EC6U4nTmI62HXjhOtwXSk-QFrkgw6rKNaQ5cjVoFO4IozE8frgoXmhORrU&usqp=CAU"
  }
];

// =============== TicTacToe Engine ===============
type Cell = "X" | "O" | null;
type Board = Cell[];
const emptyBoard = (): Board => Array(9).fill(null);

const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
] as const;

function evaluate(board: Board) {
  for (const [a,b,c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return { winner: board[a], line: [a,b,c] };
    }
  }
  return { winner: null, line: null };
}

function calcOutcome(board: Board) {
  const { winner } = evaluate(board);
  if (winner) return winner;
  if (board.every(c => c !== null)) return "Draw";
  return null;
}

function spots(b:Board){ return b.reduce<number[]>((a,c,i)=>{ if(!c)a.push(i); return a;},[]); }

function minimax(board:Board,isMax:boolean,depth:number){
  const o = calcOutcome(board);
  if(o==="O") return {score:10-depth,move:null};
  if(o==="X") return {score:-10+depth,move:null};
  if(o==="Draw") return {score:0,move:null};

  const moves = spots(board);

  if(isMax){
    let best={score:-Infinity,move:moves[0]??null};
    for(const m of moves){
      const next=[...board]; next[m]="O";
      const r=minimax(next,false,depth+1);
      if(r.score>best.score) best={score:r.score,move:m};
    }
    return best;
  } else {
    let best={score:Infinity,move:moves[0]??null};
    for(const m of moves){
      const next=[...board]; next[m]="X";
      const r=minimax(next,true,depth+1);
      if(r.score<best.score) best={score:r.score,move:m};
    }
    return best;
  }
}

// Confetti (optional celebration)
async function fireConfetti(){
  try{
    const confetti=(await import("canvas-confetti")).default;
    confetti({particleCount:120,spread:90,startVelocity:35,origin:{y:0.6}});
  } catch {}
}

// =============== TicTacToe Board Component ===============
const TicTacToeBoard:React.FC<{onBack:()=>void}> = ({onBack})=>{
  const [board,setBoard] = useState(emptyBoard());
  const [turn,setTurn] = useState<"X"|"O">("X");
  const [winner,setWinner] = useState<"X"|"O"|"Draw"|null>(null);
  const [winLine,setWinLine] = useState<number[]|null>(null);
  const [moves,setMoves] = useState<{msg:string}[]>([]);
  const [thinking,setThinking]=useState(false);
  const logRef=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{ logRef.current?.scrollTo({top:9999,behavior:"smooth"}); },[moves]);

  const status = useMemo(()=>{
    if(winner==="X") return "🎉 You Win!";
    if(winner==="O") return "🤖 AI Wins!";
    if(winner==="Draw") return "🤝 Draw!";
    return turn==="X" ? "Your Move (X)" : "AI Thinking…";
  },[turn,winner]);

  const playHuman=(i:number)=>{
    if(winner||thinking||turn!=="X"||board[i])return;
    const next=[...board]; next[i]="X";
    setMoves(m=>[...m,{msg:`You placed X at cell ${i+1}` }]);
    setBoard(next);
    const {winner:w,line}=evaluate(next);
    if(w){ setWinner(w); setWinLine(line); fireConfetti(); return;}
    if(next.every(c=>c)) { setWinner("Draw"); return; }
    setTurn("O");
  };

  useEffect(()=>{
    if(winner||turn!=="O")return;
    setThinking(true);
    setMoves(m=>[...m,{msg:`AI is thinking…`}]);
    setTimeout(()=>{
      const {move}=minimax(board,true,0);
      if(move!==null){
        const next=[...board]; next[move]="O";
        setMoves(m=>[...m,{msg:`AI placed O at cell ${move+1}`}]);
        setBoard(next);
        const {winner:w,line}=evaluate(next);
        if(w){ setWinner(w); setWinLine(line); fireConfetti(); }
        else if(next.every(c=>c)) setWinner("Draw");
        else setTurn("X");
      }
      setThinking(false);
    },400);
  },[turn,winner,board]);

  const reset=()=>{
    setBoard(emptyBoard());
    setTurn("X"); setWinner(null); setWinLine(null); setMoves([]);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-8 max-w-5xl mx-auto">
      
      {/* Board Section */}
      <div className="flex flex-col items-center">
        <div className="flex justify-between w-full max-w-md mb-3">
          <h2 className="font-bold text-xl text-gray-900 dark:text-white">Tic-Tac-Toe</h2>
          <div className="flex gap-2">
            <button onClick={reset} className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700">New</button>
            <button onClick={onBack} className="px-3 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white">Back</button>
          </div>
        </div>

        <div className="mb-4 px-4 py-2 text-sm font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
          {status}
        </div>

        {/* CENTERED BOARD */}
        <div className="grid grid-cols-3 gap-3 p-4 rounded-3xl bg-white/70 dark:bg-gray-800/70 backdrop-blur border shadow-xl">
          {board.map((v,i)=>(
            <button
              key={i}
              onClick={()=>playHuman(i)}
              className={`w-24 h-24 flex items-center justify-center text-4xl font-bold rounded-xl border 
                ${winLine?.includes(i)? "border-green-400 shadow-[0_0_8px_rgba(34,197,94,0.7)]" : "border-gray-300 dark:border-gray-600"}
                ${v?"bg-white dark:bg-gray-900":"bg-gray-50 hover:bg-white dark:bg-gray-900/40"}`}
            >
              {v==="X" ? <span className="text-blue-600">X</span> :
               v==="O" ? <span className="text-rose-500">O</span> : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Commentary Panel */}
      <div className="rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-900 shadow">
        <div className="p-3 border-b dark:border-gray-700 font-semibold text-gray-900 dark:text-white">Live Commentary</div>
        <div ref={logRef} className="p-3 h-[320px] space-y-2 overflow-y-auto text-sm text-gray-800 dark:text-gray-200">
          {moves.map((m,i)=> <div key={i}>• {m.msg}</div>)}
        </div>
      </div>
    </div>
  );
};

// =============== Page Container ===============
const Page:React.FC=()=>{
  const [selected,setSelected]=useState<string|null>(null);

  return(
    <div className="min-h-screen p-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Game Zone</h1>

        {!selected && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {GAMES.map(g=>(
              <motion.button key={g.id} whileHover={{y:-4}}
                className="text-left rounded-2xl overflow-hidden border bg-white dark:bg-gray-900 shadow"
                onClick={()=>setSelected(g.id)}>
                <img src={g.img} className="w-full h-36 object-cover"/>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{g.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{g.desc}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {selected==="tictactoe" && <TicTacToeBoard onBack={()=>setSelected(null)}/>}
      </div>
    </div>
  );
};

export default Page;
