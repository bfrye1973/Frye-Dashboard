import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state = { hasError:false, err:null, info:null }; }
  static getDerivedStateFromError(err){ return { hasError:true, err }; }
  componentDidCatch(err, info){ console.error("[App error]", err, info); this.setState({ info }); }

  render(){
    if(this.state.hasError){
      return (
        <div style={{padding:20, color:"#e5e7eb", fontFamily:"ui-sans-serif", background:"#0d1117"}}>
          <h2 style={{marginTop:0}}>Something went wrong.</h2>
          <pre style={{whiteSpace:"pre-wrap", background:"#111827", padding:12, borderRadius:8}}>
{String(this.state.err)}
          </pre>
          <details style={{opacity:.8}}>
            <summary>stack</summary>
            <pre style={{whiteSpace:"pre-wrap"}}>{this.state.info?.componentStack || "no stack"}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
