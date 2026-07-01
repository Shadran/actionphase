import { useToast } from "@/contexts/ToastContext";
import { apiClient } from "@/lib/api";
import type { GameLog } from "@/types/games";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Spinner } from "./ui";

export interface GameLogsViewProps {
    gameId: number
}

export const GameLogsView = ({ gameId } : GameLogsViewProps) => {
    const { showError } = useToast();
    const [logs, setLogs] = useState<GameLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    

    const fetchLogs = useCallback(async () => {
        try {
        setLoading(true);
        const response = await apiClient.games.getGameLogs(gameId);
        setLogs(response.data);
        setError(null);
        } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load logs');
        } finally {
        setLoading(false);
        }
    }, [gameId]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);
    
      if (loading) {
        return (
          <Card variant="elevated" padding="lg">
            <h2 className="text-2xl font-bold text-content-primary mb-6">Logs</h2>
            <div className="flex justify-center py-8">
              <Spinner size="lg" label="Loading logs..." />
            </div>
          </Card>
        );
      }
    
      if (error) {
        return (
          <Card variant="elevated" padding="lg">
            <h2 className="text-2xl font-bold text-content-primary mb-6">Logs</h2>
            <Alert variant="danger">
              <div className="space-y-3">
                <p>Failed to load logs: {error}</p>
                <Button variant="danger" size="sm" onClick={fetchLogs}>
                  Retry
                </Button>
              </div>
            </Alert>
          </Card>
        );
      }

    return (
        <>
            <h2 className="text-2xl font-bold text-content-primary mb-6">Game Logs</h2>
            {
                logs.map(l => {
                    let date = new Date(l.created_at);
                    return (<p className="text-content-primary">{date.toString()} - {l.message}</p>)
                })
            }
        </>
    );
}