# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a student scoring system (马亦谦打分系统) built as a single-page web application. The system allows teachers to manage student scores with features including random student selection, score input, statistics display, and data persistence.

## Architecture

The application follows a simple client-side architecture:
- **Frontend**: Vanilla HTML/CSS/JavaScript single-page application
- **Data Storage**: Local browser storage (localStorage) with API backup
- **API Integration**: RESTful API for data persistence and synchronization

### Core Components

- **Student Management**: Add, remove, and randomly select students
- **Scoring System**: Multiple scoring modes (random, custom, extra points)
- **Statistics**: Real-time calculation and display of class statistics
- **Data Persistence**: Automatic save/load with API synchronization
- **Theme Support**: Light/dark mode toggle

### Key Files

- `index.html`: Main application interface with all UI components
- `script.js`: Core application logic, API integration, and event handling
- `styles.css`: Complete styling including responsive design and themes
- `README.md`: Project documentation and setup instructions

## API Integration

The system integrates with a backend API for data persistence:
- Base URL: `https://api.mayiqian.top`
- Endpoints: `/students`, `/scores`, `/stats`
- Authentication: Not required for current implementation
- Data sync: Automatic background synchronization with localStorage fallback

## Development Workflow

Since this is a static web application:
- **Local Development**: Open `index.html` directly in browser or use local server
- **Testing**: Manual testing through browser interface
- **Deployment**: Copy files to web server (static hosting)

## Key Features and Implementation Details

### Student Data Structure
Students are stored with: `id`, `name`, `scores[]`, `totalScore`, `averageScore`

### Scoring Modes
- **Random Scoring**: Automated score assignment with configurable ranges
- **Custom Scoring**: Manual score input with validation
- **Extra Points**: Bonus point system for achievements

### Data Persistence Strategy
1. Primary storage in localStorage for offline functionality
2. Background API synchronization when available
3. Conflict resolution favors local data during active sessions

### Statistics Calculation
Real-time computation of class averages, distributions, and performance metrics with automatic updates on score changes.

## Common Tasks

**View the application**: Open `index.html` in a web browser
**Make changes**: Edit the respective HTML, CSS, or JavaScript files
**Test changes**: Refresh the browser after saving files
**Debug**: Use browser developer tools console for JavaScript debugging

## Technical Notes

- No build process or dependencies required
- Compatible with modern browsers (ES6+ features used)
- Responsive design supports mobile and desktop viewing
- Chinese language interface with UTF-8 encoding