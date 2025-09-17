import { useEffect, useState } from "react";


export function useReplayState() {
const [on, setOn] = useState(false);
const [granularity, setGranularity] = useState("10min"); // 10min | 1h | 1d
const [ts, setTs] = useState("");
return { on, setOn, granularity, setGranularity, ts, setTs };
}
