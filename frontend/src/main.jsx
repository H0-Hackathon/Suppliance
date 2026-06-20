import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import 'antd/dist/reset.css'
import './styles/index.css'

// Error boundary to catch and display runtime errors during development
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('CoastGuard render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: 'Inter, sans-serif' }}>
          <h2 style={{ color: '#EF4444' }}>Something went wrong</h2>
          <pre style={{ background: '#F8FAFC', padding: 16, borderRadius: 8, overflow: 'auto' }}>
            {this.state.error?.toString()}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
